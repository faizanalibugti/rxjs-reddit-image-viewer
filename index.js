// RxJs Imports
const {
  Observable,
  EMPTY,
  defer,
  interval,
  timer,
  range,
  from,
  fromEvent,
  of,
  tap,
  merge,
  concat,
  distinctUntilChanged,
} = rxjs;
const {
  take,
  scan,
  filter,
  map,
  concatAll,
  takeUntil,
  switchMap,
  concatMap,
  mergeMap,
  catchError,
  retry,
} = rxjs.operators;
const { fromFetch } = rxjs.fetch;

// DOM Elements
const nextButton = document.getElementById("next");
const backButton = document.getElementById("back");
const subSelect = document.getElementById("sub");
const img = document.getElementById("img");
const loading = document.getElementById("loading");

// Fallback if failed to load image
const LOADING_ERROR_URL =
  "https://jhusain.github.io/reddit-image-viewer/error.png";

// function which returns an array of image URLs for a given reddit sub
// getSubImages("pics") ->
// [
//   "https://upload.wikimedia.org/wikipedia/commons/3/36/Hopetoun_falls.jpg",
//   "https://upload.wikimedia.org/wikipedia/commons/3/38/4-Nature-Wallpapers-2014-1_ukaavUI.jpg",
//   ...
// ]

function getSubImages(sub) {
  const cachedImages = localStorage.getItem(sub);
  if (cachedImages) {
    return of(JSON.parse(cachedImages));
  } else {
    const url = `https://www.reddit.com/r/${sub}/.json?limit=200&show=all`;

    // defer ensure new Observable (and therefore) promise gets created
    // for each subscription. This ensures functions like retry will
    // issue additional requests.
    return defer(() =>
      from(
        fetch(url)
          .then((res) => res.json())
          .then((data) => {
            const images = data.data.children.map((image) => image.data.url);
            localStorage.setItem(sub, JSON.stringify(images));
            return images;
          })
      )
    );
  }
}

// Observable for Select dropdown
const sub$ = concat(
  of(subSelect.value),
  fromEvent(sub, "change").pipe(map((e) => e.target.value))
);

// Observable for Next button clicks
const next$ = fromEvent(nextButton, "click");

// Observable for back button clicks
const back$ = fromEvent(backButton, "click");

// Observable to map image array from getSubImages function to array of 1 (next) & -1 (back)
const offset$ = merge(next$.pipe(map(() => 1)), back$.pipe(map(() => -1)));

// Observable to map array of next and back clicks [1,-1,1] to accumulated indexes to display image at particular index of reddit image urls array
const indice$ = concat(of(0), offset$.pipe(scan((acc, curr) => acc + curr, 0)));

// [1,2,3].map(x => [x]) -> [[1], [2], [3]]
const image$ = sub$.pipe(
  switchMap((sub) =>
    getSubImages(sub).pipe(
      switchMap((image) =>
        indice$.pipe(
          filter((index) => index >= 0 && index < image.length),
          map((index) => image[index])
        )
      ),
      switchMap(preLoadImage)
    )
  )
);

// This "actions" Observable is a placeholder. Replace it with an
// observable that notfies whenever a user performs an action,
// like changing the sub or navigating the images
const actions = merge(sub$, next$, back$);

actions.subscribe(() => (loading.style.visibility = "visible"));

image$.subscribe({
  next(url) {
    // hide the loading image
    loading.style.visibility = "hidden";

    // set Image source to URL
    img.src = url;
  },
  error(e) {
    alert(
      "I'm having trouble loading the images for that sub. Please wait a while, reload, and then try again later."
    );
  },
});

// Preload image observable to check whether image is valid or not
function preLoadImage(src) {
  return defer(() => {
    console.log(src);
    const img = new Image();
    const success$ = fromEvent(img, "load").pipe(map(() => src));
    const failure$ = fromEvent(img, "error").pipe(map(() => LOADING_ERROR_URL));

    img.src = src;

    return merge(success$, failure$);
  });
}