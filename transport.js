const form = document.querySelector("#transportForm");
const isResultsPage = document.body.dataset.page === "transport-results";
const originInput = document.querySelector("#origin");
const destinationInput = document.querySelector("#destination");
const useLocationButton = document.querySelector("#useLocation");
const locationStatus = document.querySelector("#locationStatus");
const locationPickerStatus = document.querySelector("#locationPickerStatus");
const locationPickerMap = document.querySelector("#locationPickerMap");
const pickPickupOnMapButton = document.querySelector("#pickPickupOnMap");
const pickDestinationOnMapButton = document.querySelector("#pickDestinationOnMap");
const originPointBox = document.querySelector("#originPoint");
const destinationPointBox = document.querySelector("#destinationPoint");
const routeSubmitButton = document.querySelector("#transportSubmit");
const errorMessage = document.querySelector("#transportError");
const results = document.querySelector("#transportResults");
const routePageError = document.querySelector("#routePageError");
const routeLookupStatus = document.querySelector("#routeLookupStatus");
const routeOrigin = document.querySelector("#routeOrigin");
const routeDestination = document.querySelector("#routeDestination");
const originCoordinatesLabel = document.querySelector("#originCoordinates");
const destinationCoordinatesLabel = document.querySelector("#destinationCoordinates");
const routeDistance = document.querySelector("#routeDistance");
const bikeFare = document.querySelector("#bikeFare");
const carFare = document.querySelector("#carFare");
const bikeDistance = document.querySelector("#bikeDistance");
const carDistance = document.querySelector("#carDistance");
const selectedVehicle = document.querySelector("#selectedVehicle");
const selectedFare = document.querySelector("#selectedFare");
const bookNowButton = document.querySelector("#bookNow");
const bikeAvailability = document.querySelector("#bikeAvailability");
const carAvailability = document.querySelector("#carAvailability");
const availabilityNote = document.querySelector("#availabilityNote");
const customerAuthStatus = document.querySelector("#customerAuthStatus");
const customerAuthLink = document.querySelector("#customerAuthLink");
const bookingError = document.querySelector("#bookingError");
const bookingStatus = document.querySelector("#bookingStatus");
const transportSuccess = document.querySelector("#transportSuccess");
const transportSuccessText = document.querySelector("#transportSuccessText");
const outsideWarning = document.querySelector("#outsideCampusWarning");
const confirmOutsideButton = document.querySelector("#confirmOutsideCampus");
const selectPickupButton = document.querySelector("#selectPickupOnMap");
const selectDestinationButton = document.querySelector("#selectDestinationOnMap");

const campusCenter = { latitude: 28.4226598, longitude: 77.5257227 };
// Photon returned this campus feature extent; it is not a surveyed campus boundary.
const campusBounds = {
  north: 28.4332299,
  south: 28.4121277,
  east: 77.533729,
  west: 77.5155537
};
const routeSessionKey = "sevaConnectTransportRoute";
const routeSessionMaxAgeMs = 30 * 60 * 1000;

let originPoint = null;
let destinationPoint = null;
let outsideConfirmed = false;
let activePoint = "pickup";
let routeDistanceKm = null;
let chosenVehicle = null;
let map = null;
let originMarker = null;
let destinationMarker = null;
let routeLayer = null;
let locationAccuracyMeters = null;
let submittingBooking = false;
let currentCustomer = null;
let liveProviderRecords = [];
let providerMarkers = [];
let liveProviderUnsubscribe = null;
let availabilityRefreshTimer = null;
let routeTimer = null;
let routeCalculationId = 0;
let searchTimers = new WeakMap();
let searchRequests = new WeakMap();
const placeCache = new Map();

function setError(message = "") {
  if (!errorMessage) return;
  errorMessage.textContent = message;
  errorMessage.hidden = !message;
}

function setBookingError(message = "") {
  if (!bookingError) return;
  bookingError.textContent = message;
  bookingError.hidden = !message;
}

function setLocationStatus(message = "", isError = false) {
  if (!locationStatus) return;
  locationStatus.textContent = message;
  locationStatus.classList.toggle("error", isError);
}

function updateBookButtonState() {
  if (!bookNowButton) return;
  bookNowButton.disabled = submittingBooking ||
    !currentCustomer ||
    !originPoint ||
    !destinationPoint ||
    routeDistanceKm === null ||
    !chosenVehicle;
}

function getLiveProviderRecords() {
  return liveProviderRecords.filter(record => {
    const expiresAt = record.expiresAt?.toDate
      ? record.expiresAt.toDate().getTime()
      : Number.NaN;
    return record.status === "available" &&
      record.serviceArea === "Gautam Buddha University, Greater Noida" &&
      expiresAt > Date.now() &&
      Number.isFinite(record.coordinates?.latitude) &&
      Number.isFinite(record.coordinates?.longitude) &&
      ["Bike", "Car"].includes(record.vehicleType);
  });
}

function updateLiveProviderDisplay() {
  if (!isResultsPage) return;
  const providers = getLiveProviderRecords();
  const bikes = providers.filter(provider => provider.vehicleType === "Bike").length;
  const cars = providers.filter(provider => provider.vehicleType === "Car").length;
  bikeAvailability.textContent = bikes ? `${bikes} live` : "None live";
  carAvailability.textContent = cars ? `${cars} live` : "None live";
  availabilityNote.textContent = providers.length
    ? "Markers show signed-in providers with a current available location. Locations may be delayed by device, network, or browser limits."
    : "No live providers are currently sharing availability. No vehicle markers or live count are shown.";

  providerMarkers.forEach(marker => marker.remove());
  providerMarkers = [];
  if (!map) return;
  providers.forEach(provider => {
    const icon = provider.vehicleType === "Bike" ? "🏍️" : "🚗";
    const element = document.createElement("div");
    element.className = "live-provider-marker";
    element.textContent = icon;
    element.title = `Live ${provider.vehicleType} provider`;
    element.addEventListener("click", event => event.stopPropagation());
    const marker = new maplibregl.Marker({ element, anchor: "center" })
      .setLngLat([provider.coordinates.longitude, provider.coordinates.latitude])
      .setPopup(new maplibregl.Popup({ offset: 20 }).setText(`Live ${provider.vehicleType} provider`))
      .addTo(map);
    providerMarkers.push(marker);
  });
}

function clearLiveProviderSubscription() {
  if (liveProviderUnsubscribe) liveProviderUnsubscribe();
  liveProviderUnsubscribe = null;
  if (availabilityRefreshTimer) window.clearInterval(availabilityRefreshTimer);
  availabilityRefreshTimer = null;
  liveProviderRecords = [];
  updateLiveProviderDisplay();
}

function subscribeToLiveProviders() {
  clearLiveProviderSubscription();
  if (!currentCustomer || !window.sevaFirestore || !window.firebase) return;

  const refresh = () => {
    if (liveProviderUnsubscribe) liveProviderUnsubscribe();
    const cutoff = window.firebase.firestore.Timestamp.fromMillis(Date.now() + 15000);
    liveProviderUnsubscribe = window.sevaFirestore.collection("providerAvailability")
      .where("status", "==", "available")
      .where("serviceArea", "==", "Gautam Buddha University, Greater Noida")
      .where("expiresAt", ">", cutoff)
      .onSnapshot(snapshot => {
        liveProviderRecords = snapshot.docs.map(document => document.data());
        updateLiveProviderDisplay();
      }, error => {
        console.error("Could not load live provider availability:", error);
        liveProviderRecords = [];
        updateLiveProviderDisplay();
        availabilityNote.textContent = error?.code === "permission-denied"
          ? "Firebase rules did not allow loading live providers. Publish the current rules."
          : "Live provider availability could not be loaded. Check your connection and Firestore index.";
      });
  };

  refresh();
  availabilityRefreshTimer = window.setInterval(refresh, 30000);
}

async function loadCustomerProfile(user) {
  if (!isResultsPage) return;
  clearLiveProviderSubscription();
  currentCustomer = null;
  updateBookButtonState();
  if (!user) {
    customerAuthStatus.textContent = "Sign in with a customer account to see live providers and submit a request.";
    customerAuthLink.hidden = false;
    availabilityNote.textContent = "Sign in with a customer account to see live provider availability.";
    return;
  }

  try {
    const snapshot = await window.sevaFirestore.collection("customers").doc(user.uid).get();
    if (!snapshot.exists || snapshot.data().role !== "customer") {
      customerAuthStatus.textContent = "This sign-in is not linked to a customer profile. Sign in with a customer account.";
      customerAuthLink.hidden = false;
      availabilityNote.textContent = "Customer sign-in is required to see live provider availability.";
      return;
    }

    currentCustomer = { uid: user.uid, ...snapshot.data() };
    customerAuthStatus.textContent = `Signed in as ${currentCustomer.emailAddress || user.email || "customer"}.`;
    customerAuthLink.hidden = true;
    updateBookButtonState();
    subscribeToLiveProviders();
  } catch (error) {
    console.error("Could not load the customer profile:", error);
    customerAuthStatus.textContent = error?.code === "permission-denied"
      ? "Firebase rules did not allow loading your customer profile. Publish the current rules."
      : "We could not load your customer profile. Check your connection and try again.";
    customerAuthLink.hidden = false;
  }
}

function formatCoordinates(point) {
  return `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`;
}

function updatePointBox(box, point) {
  if (!point || !box) return;
  box.hidden = false;
  box.querySelector(".selected-address").textContent = point.label;
  box.querySelector(".selected-coordinates").textContent = formatCoordinates(point);
}

function isValidPoint(point) {
  return point &&
    typeof point.label === "string" &&
    point.label.trim().length > 0 &&
    point.label.length <= 300 &&
    Number.isFinite(point.latitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    Number.isFinite(point.longitude) &&
    point.longitude >= -180 &&
    point.longitude <= 180 &&
    (point.accuracyMeters === undefined ||
      (Number.isFinite(point.accuracyMeters) && point.accuracyMeters > 0));
}

function readRouteSession() {
  try {
    const raw = window.sessionStorage.getItem(routeSessionKey);
    if (!raw) return null;

    const request = JSON.parse(raw);
    const age = Date.now() - request.createdAt;
    if (
      request.version !== 1 ||
      !Number.isFinite(request.createdAt) ||
      age < -60000 ||
      age > routeSessionMaxAgeMs ||
      !isValidPoint(request.origin) ||
      !isValidPoint(request.destination)
    ) {
      window.sessionStorage.removeItem(routeSessionKey);
      return null;
    }

    return {
      createdAt: request.createdAt,
      origin: request.origin,
      destination: request.destination
    };
  } catch (error) {
    console.warn("Could not read the saved transport locations:", error);
    return null;
  }
}

function writeRouteSession(origin, destination) {
  const request = {
    version: 1,
    createdAt: Date.now(),
    origin: {
      latitude: origin.latitude,
      longitude: origin.longitude,
      label: origin.label,
      ...(Number.isFinite(origin.accuracyMeters) ? { accuracyMeters: origin.accuracyMeters } : {})
    },
    destination: {
      latitude: destination.latitude,
      longitude: destination.longitude,
      label: destination.label
    }
  };
  window.sessionStorage.setItem(routeSessionKey, JSON.stringify(request));
}

function isWithinApproximateCampus(point) {
  return point.latitude <= campusBounds.north &&
    point.latitude >= campusBounds.south &&
    point.longitude <= campusBounds.east &&
    point.longitude >= campusBounds.west;
}

function showCampusWarning() {
  const outside = (originPoint && !isWithinApproximateCampus(originPoint)) ||
    (destinationPoint && !isWithinApproximateCampus(destinationPoint));
  if (!outsideWarning || !confirmOutsideButton) return outside;
  outsideWarning.hidden = !outside;
  confirmOutsideButton.hidden = !outside;
  confirmOutsideButton.textContent = outsideConfirmed
    ? "Outside-campus point confirmed"
    : "Confirm point outside campus";
  confirmOutsideButton.disabled = outsideConfirmed;
  return outside;
}

async function searchCampusPlace(query) {
  if (!query || query.trim().length < 2) {
    throw new Error("Enter at least 2 characters to search.");
  }

  const cachedPoint = placeCache.get(query.trim().toLowerCase());
  if (cachedPoint) return cachedPoint;

  const places = await findCampusPlaces(query);
  if (!places.length) {
    throw new Error(`No mapped campus place matches "${query}". Choose the exact point on the map instead.`);
  }

  const point = places[0];
  placeCache.set(query.trim().toLowerCase(), point);
  return point;
}

async function findCampusPlaces(query) {
  const bbox = [
    campusBounds.west,
    campusBounds.south,
    campusBounds.east,
    campusBounds.north
  ].join(",");
  const params = new URLSearchParams({
    q: query.trim(),
    limit: "15",
    lat: String(campusCenter.latitude),
    lon: String(campusCenter.longitude),
    bbox,
    lang: "en"
  });
  const response = await fetch(`https://photon.komoot.io/api/?${params}`);
  if (!response.ok) throw new Error("Campus place search is unavailable. Try again or choose the point on the map.");

  const data = await response.json();
  const seen = new Set();
  return (data.features || []).reduce((places, feature) => {
    const coordinates = feature.geometry?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) return places;

    const [longitude, latitude] = coordinates;
    const point = { latitude, longitude };
    if (!isValidPoint({ ...point, label: "Campus location" }) || !isWithinApproximateCampus(point)) {
      return places;
    }

    const properties = feature.properties || {};
    const labelParts = [
      properties.name,
      properties.housenumber && properties.street
        ? `${properties.housenumber} ${properties.street}`
        : properties.street,
      properties.suburb,
      properties.district,
      properties.city
    ].filter(Boolean);
    const label = [...new Set(labelParts)].join(", ");
    const key = `${label.toLowerCase()}|${latitude.toFixed(6)},${longitude.toFixed(6)}`;
    if (!label || seen.has(key)) return places;
    seen.add(key);
    places.push({ ...point, label });
    return places;
  }, []);
}

function getSuggestionList(input) {
  return document.querySelector(`#${input.id}Suggestions`);
}

function hideSuggestions(input) {
  const list = getSuggestionList(input);
  if (!list) return;
  list.hidden = true;
  list.replaceChildren();
  input.setAttribute("aria-expanded", "false");
}

function showSuggestions(input, list, items) {
  list.replaceChildren(...items);
  list.hidden = false;
  input.setAttribute("aria-expanded", "true");
}

function createSuggestionButton(label, onSelect, className = "") {
  const option = document.createElement("button");
  option.type = "button";
  option.className = `transport-suggestion${className ? ` ${className}` : ""}`;
  option.setAttribute("role", "option");
  option.setAttribute("aria-selected", "false");
  option.textContent = label;
  option.addEventListener("pointerdown", event => event.preventDefault());
  option.addEventListener("click", onSelect);
  return option;
}

function openLocationPicker(type) {
  activePoint = type;
  if (locationPickerStatus) {
    locationPickerStatus.textContent = `Tap the map to set the ${type === "pickup" ? "pickup" : "destination"} pin.`;
  }
  if (!locationPickerMap) return;

  locationPickerMap.hidden = false;
  try {
    initializeMap();
    requestAnimationFrame(() => map.resize());
  } catch (error) {
    console.error("Could not open the campus location picker:", error);
    setError("The map is unavailable. Check your connection and try again.");
  }
}

function searchPlaceSuggestions(input, type) {
  if (!input) return;
  const list = getSuggestionList(input);
  if (!list) return;

  let highlightedIndex = -1;
  input.addEventListener("input", () => {
    clearTimeout(searchTimers.get(input));
    const requestId = (searchRequests.get(input) || 0) + 1;
    searchRequests.set(input, requestId);
    highlightedIndex = -1;
    const query = input.value.trim();
    list.replaceChildren();
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    if (query.length < 2) return;

    const loading = document.createElement("div");
    loading.className = "transport-suggestion-message";
    loading.textContent = "Searching campus places…";
    showSuggestions(input, list, [loading]);

    const timer = setTimeout(async () => {
      try {
        const places = await findCampusPlaces(query);
        if (searchRequests.get(input) !== requestId) return;

        const options = places.map(point => createSuggestionButton(point.label, () => {
          placeCache.set(query.toLowerCase(), point);
          placeCache.set(point.label.toLowerCase(), point);
          input.value = point.label;
          hideSuggestions(input);
          setPoint(type, point);
        }));

        if (places.length) {
          options.push(createSuggestionButton(
            "Choose an exact point on the map…",
            () => {
              hideSuggestions(input);
              openLocationPicker(type);
            },
            "transport-suggestion-map"
          ));
        } else {
          const noResults = document.createElement("div");
          noResults.className = "transport-suggestion-message";
          noResults.textContent = "No mapped campus place found.";
          options.push(noResults);
          options.push(createSuggestionButton(
            "Choose this place on the map…",
            () => {
              hideSuggestions(input);
              openLocationPicker(type);
            },
            "transport-suggestion-map"
          ));
        }
        showSuggestions(input, list, options);
        highlightedIndex = -1;
      } catch (error) {
        if (searchRequests.get(input) !== requestId) return;
        console.warn("Campus place suggestions are unavailable:", error);
        const message = document.createElement("div");
        message.className = "transport-suggestion-message";
        message.textContent = "Suggestions are unavailable right now.";
        const mapOption = createSuggestionButton(
          "Choose the exact point on the map…",
          () => {
            hideSuggestions(input);
            openLocationPicker(type);
          },
          "transport-suggestion-map"
        );
        showSuggestions(input, list, [message, mapOption]);
      }
    }, 250);
    searchTimers.set(input, timer);
  });

  input.addEventListener("keydown", event => {
    const options = [...list.querySelectorAll('[role="option"]')];
    if (event.key === "ArrowDown" && options.length) {
      event.preventDefault();
      highlightedIndex = (highlightedIndex + 1) % options.length;
    } else if (event.key === "ArrowUp" && options.length) {
      event.preventDefault();
      highlightedIndex = (highlightedIndex - 1 + options.length) % options.length;
    } else if (event.key === "Enter" && highlightedIndex >= 0 && options[highlightedIndex]) {
      event.preventDefault();
      options[highlightedIndex].click();
      return;
    } else if (event.key === "Escape") {
      hideSuggestions(input);
      return;
    } else {
      return;
    }

    options.forEach((option, index) => {
      option.setAttribute("aria-selected", String(index === highlightedIndex));
    });
  });

  input.addEventListener("blur", () => {
    window.setTimeout(() => hideSuggestions(input), 120);
  });
}

async function calculateRoute(origin, destination) {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Route calculation failed.");

  const data = await response.json();
  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error("A drivable route could not be found. Fine-tune the points or try another campus location.");
  }
  if (
    !Number.isFinite(data.routes[0].distance) ||
    data.routes[0].distance <= 0 ||
    !data.routes[0].geometry?.coordinates?.length
  ) {
    throw new Error("Pickup and destination need to be different valid locations.");
  }

  return {
    distanceMeters: data.routes[0].distance,
    geometry: data.routes[0].geometry
  };
}

function initializeMap() {
  if (!window.maplibregl) throw new Error("The map could not be loaded.");
  if (map) return;
  const mapContainer = isResultsPage
    ? document.querySelector("#routeMap")
    : locationPickerMap;
  if (!mapContainer) throw new Error("The campus location map is unavailable on this page.");

  map = new maplibregl.Map({
    container: mapContainer,
    style: "https://tiles.waymorphic.com/styles/positron",
    center: [campusCenter.longitude, campusCenter.latitude],
    zoom: 15
  });
  map.addControl(new maplibregl.NavigationControl(), "top-right");
  map.on("load", () => {
    map.addSource("campus-boundary", {
      type: "geojson",
      data: campusBoundaryFeature()
    });
    map.addLayer({
      id: "campus-boundary-fill",
      type: "fill",
      source: "campus-boundary",
      paint: { "fill-color": "#176b48", "fill-opacity": 0.03 }
    });
    map.addLayer({
      id: "campus-boundary-line",
      type: "line",
      source: "campus-boundary",
      paint: {
        "line-color": "#176b48",
        "line-width": 1,
        "line-opacity": 0.55,
        "line-dasharray": [2, 2]
      }
    });
    updateMarkers();
    drawRouteOnMap();
    updateLiveProviderDisplay();
  });
  map.on("error", event => {
    if (event.error) console.warn("The transport map reported an error:", event.error);
  });

  map.on("click", event => {
    if (event.originalEvent?.target?.closest?.(".maplibregl-marker")) return;
    const currentLabel = activePoint === "pickup"
      ? originInput?.value.trim()
      : destinationInput?.value.trim();
    const point = {
      latitude: event.lngLat.lat,
      longitude: event.lngLat.lng,
      label: currentLabel
        ? `${currentLabel} (map pin)`
        : `Map-selected ${activePoint === "pickup" ? "pickup" : "destination"} point`
    };
    setPoint(activePoint, point);
    if (locationPickerStatus && !isResultsPage) {
      locationPickerStatus.textContent = `${activePoint === "pickup" ? "Pickup" : "Destination"} pin selected at ${formatCoordinates(point)}.`;
    }
  });

  requestAnimationFrame(() => map.resize());
  updateLiveProviderDisplay();
}

function campusBoundaryFeature() {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [[
        [campusBounds.west, campusBounds.south],
        [campusBounds.east, campusBounds.south],
        [campusBounds.east, campusBounds.north],
        [campusBounds.west, campusBounds.north],
        [campusBounds.west, campusBounds.south]
      ]]
    }
  };
}

function createAccuracyCircleFeature(point, radiusMeters) {
  const coordinates = [];
  const latitudeRadians = point.latitude * Math.PI / 180;
  for (let index = 0; index <= 64; index += 1) {
    const angle = index * 2 * Math.PI / 64;
    const latitude = point.latitude + (radiusMeters / 111320) * Math.cos(angle);
    const longitude = point.longitude +
      (radiusMeters / (111320 * Math.cos(latitudeRadians))) * Math.sin(angle);
    coordinates.push([longitude, latitude]);
  }
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [coordinates] }
  };
}

function updateAccuracyCircle() {
  if (!map || !map.isStyleLoaded()) return;
  const data = originPoint && locationAccuracyMeters
    ? createAccuracyCircleFeature(originPoint, locationAccuracyMeters)
    : { type: "FeatureCollection", features: [] };
  const source = map.getSource("pickup-accuracy");
  if (source) {
    source.setData(data);
    return;
  }
  map.addSource("pickup-accuracy", { type: "geojson", data });
  map.addLayer({
    id: "pickup-accuracy-fill",
    type: "fill",
    source: "pickup-accuracy",
    paint: {
      "fill-color": "#176b48",
      "fill-opacity": 0.12,
      "fill-outline-color": "#176b48"
    }
  });
}

function drawRouteOnMap() {
  if (!map || !map.isStyleLoaded() || !routeLayer) return;
  const data = { type: "Feature", properties: {}, geometry: routeLayer };
  const source = map.getSource("calculated-route");
  if (source) {
    source.setData(data);
  } else {
    map.addSource("calculated-route", { type: "geojson", data });
    map.addLayer({
      id: "calculated-route-line",
      type: "line",
      source: "calculated-route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#176b48", "line-width": 5, "line-opacity": 0.85 }
    });
  }
  const bounds = new maplibregl.LngLatBounds();
  routeLayer.coordinates.forEach(coordinate => bounds.extend(coordinate));
  map.fitBounds(bounds, { padding: 32, maxZoom: 16 });
}

function clearRouteLayer() {
  routeLayer = null;
  if (!map || !map.isStyleLoaded()) return;
  if (map.getLayer("calculated-route-line")) map.removeLayer("calculated-route-line");
  if (map.getSource("calculated-route")) map.removeSource("calculated-route");
}

function setPoint(type, point) {
  if (!isValidPoint(point)) return;
  outsideConfirmed = false;
  if (type === "pickup") {
    originPoint = point;
    locationAccuracyMeters = point.accuracyMeters || null;
    if (originInput) originInput.value = point.label;
    updatePointBox(originPointBox, point);
  } else {
    destinationPoint = point;
    if (destinationInput) destinationInput.value = point.label;
    updatePointBox(destinationPointBox, point);
  }

  updateMarkers();
  if (!isResultsPage) return;
  showCampusWarning();
  resetRouteResults();
  routeOrigin.textContent = originPoint?.label || "—";
  routeDestination.textContent = destinationPoint?.label || "—";
  originCoordinatesLabel.textContent = originPoint ? formatCoordinates(originPoint) : "Coordinates unavailable";
  destinationCoordinatesLabel.textContent = destinationPoint ? formatCoordinates(destinationPoint) : "Coordinates unavailable";
  routeLookupStatus.textContent = "Locations updated. Recalculating route…";
  if (originPoint && destinationPoint) {
    try {
      writeRouteSession(originPoint, destinationPoint);
    } catch (error) {
      console.error("Could not preserve the edited transport locations:", error);
      routeLookupStatus.textContent = "Could not save edited locations for refresh. The current route can still be recalculated.";
    }
  }
  scheduleRouteRecalculation();
}

function updateMarkers() {
  if (!map) return;
  if (originMarker) originMarker.remove();
  if (destinationMarker) destinationMarker.remove();

  if (originPoint) {
    const element = document.createElement("div");
    element.className = "transport-map-marker pickup-map-marker";
    element.setAttribute("aria-label", "Pickup location");
    element.addEventListener("click", event => event.stopPropagation());
    originMarker = new maplibregl.Marker({ element, draggable: true })
      .setLngLat([originPoint.longitude, originPoint.latitude])
      .setPopup(new maplibregl.Popup({ offset: 20 }).setText("Pickup — drag to adjust"))
      .addTo(map);
    originMarker.on("dragend", () => {
      const position = originMarker.getLngLat();
      setPoint("pickup", {
        latitude: position.lat,
        longitude: position.lng,
        label: "Dragged pickup point"
      });
    });
  }

  updateAccuracyCircle();

  if (destinationPoint) {
    const element = document.createElement("div");
    element.className = "transport-map-marker destination-map-marker";
    element.setAttribute("aria-label", "Destination");
    element.addEventListener("click", event => event.stopPropagation());
    destinationMarker = new maplibregl.Marker({ element, draggable: true })
      .setLngLat([destinationPoint.longitude, destinationPoint.latitude])
      .setPopup(new maplibregl.Popup({ offset: 20 }).setText("Destination — drag to adjust"))
      .addTo(map);

    destinationMarker.on("dragend", () => {
      const position = destinationMarker.getLngLat();
      setPoint("destination", {
        latitude: position.lat,
        longitude: position.lng,
        label: "Dragged destination point"
      });
    });
  }
}

function resetRouteResults() {
  if (!isResultsPage) return;
  routeDistanceKm = null;
  chosenVehicle = null;
  bookNowButton.disabled = true;
  selectedVehicle.textContent = "None";
  selectedFare.textContent = "—";
  routeDistance.textContent = "Calculating...";
  bikeFare.textContent = "—";
  carFare.textContent = "—";
  bikeDistance.textContent = "Distance unavailable";
  carDistance.textContent = "Distance unavailable";
  document.querySelectorAll(".vehicle-option").forEach(option => {
    option.setAttribute("aria-checked", "false");
    option.classList.remove("selected");
  });
  setBookingError("");
  bookingStatus.textContent = "";
  transportSuccess.hidden = true;
  clearRouteLayer();
}

function updateFares() {
  if (routeDistanceKm === null || !isResultsPage) return;

  const bikeTotal = routeDistanceKm * 5;
  const carTotal = routeDistanceKm * 10;
  bikeFare.textContent = `₹${Math.round(bikeTotal)}`;
  carFare.textContent = `₹${Math.round(carTotal)}`;
  bikeDistance.textContent = `${routeDistanceKm.toFixed(2)} km × ₹5/km`;
  carDistance.textContent = `${routeDistanceKm.toFixed(2)} km × ₹10/km`;

  if (chosenVehicle === "Bike") selectedFare.textContent = `₹${Math.round(bikeTotal)} estimated`;
  if (chosenVehicle === "Car") selectedFare.textContent = `₹${Math.round(carTotal)} estimated`;
}

async function recalculateRoute() {
  if (!originPoint || !destinationPoint) return;

  const calculationId = ++routeCalculationId;
  const origin = { ...originPoint };
  const destination = { ...destinationPoint };
  resetRouteResults();
  results.hidden = false;
  routeLookupStatus.textContent = "Calculating route...";
  routeOrigin.textContent = origin.label;
  routeDestination.textContent = destination.label;
  originCoordinatesLabel.textContent = formatCoordinates(origin);
  destinationCoordinatesLabel.textContent = formatCoordinates(destination);

  try {
    initializeMap();
    updateMarkers();
  } catch (error) {
    console.warn("The transport map could not be initialized:", error);
    routeLookupStatus.textContent = "Map unavailable. Trying to calculate the route and fare…";
  }

  const outside = showCampusWarning();
  if (outside && !outsideConfirmed) {
    routeLookupStatus.textContent = "Point outside the approximate campus boundary. Confirm or change it.";
    routeDistance.textContent = "Unavailable";
    return;
  }

  try {
    const route = await calculateRoute(origin, destination);
    if (calculationId !== routeCalculationId) return;
    routeDistanceKm = route.distanceMeters / 1000;
    routeDistance.textContent = `${routeDistanceKm.toFixed(2)} km`;
    routeLookupStatus.textContent = "Route calculated successfully.";
    updateFares();

    if (map) {
      try {
        routeLayer = route.geometry;
        drawRouteOnMap();
        setTimeout(() => map.resize(), 100);
      } catch (error) {
        console.error("Could not draw the calculated route on the map:", error);
        routeLookupStatus.textContent = "Route and fare calculated, but the route could not be drawn on the map.";
      }
    }
  } catch (error) {
    if (calculationId !== routeCalculationId) return;
    console.error("Route lookup failed:", error);
    routeLookupStatus.textContent = error.message || "Route lookup failed.";
    routeDistance.textContent = "Unavailable";
  }
}

function scheduleRouteRecalculation() {
  clearTimeout(routeTimer);
  routeCalculationId += 1;
  routeTimer = setTimeout(recalculateRoute, 350);
}

useLocationButton?.addEventListener("click", () => {
  setLocationStatus("");
  setError("");
  if (!navigator.geolocation) {
    setLocationStatus("Location detection is unavailable. Search or tap the map instead.", true);
    return;
  }

  useLocationButton.disabled = true;
  useLocationButton.textContent = "Getting location...";
  navigator.geolocation.getCurrentPosition(
    position => {
      const accuracy = position.coords.accuracy;
      const point = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        label: "My GPS-reported pickup location",
        ...(Number.isFinite(accuracy) ? { accuracyMeters: accuracy } : {})
      };
      setPoint("pickup", point);
      const accuracyText = Number.isFinite(accuracy)
        ? ` Reported accuracy radius: about ${Math.round(accuracy)} metres.`
        : "";
      setLocationStatus(`Pickup updated with high-accuracy geolocation.${accuracyText}`);
      useLocationButton.disabled = false;
      useLocationButton.innerHTML = '<span aria-hidden="true">◎</span> Use my current location';
    },
    error => {
      let message = "We could not access your location. Use campus search or tap the map.";
      if (error.code === error.PERMISSION_DENIED) message = "Location permission was denied. Use campus search or tap the map.";
      else if (error.code === error.POSITION_UNAVAILABLE) message = "Your position is unavailable. Use campus search or tap the map.";
      else if (error.code === error.TIMEOUT) message = "Location detection timed out. Use campus search or tap the map.";
      setLocationStatus(message, true);
      useLocationButton.disabled = false;
      useLocationButton.innerHTML = '<span aria-hidden="true">◎</span> Use my current location';
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
});

searchPlaceSuggestions(originInput, "pickup");
searchPlaceSuggestions(destinationInput, "destination");

originInput?.addEventListener("input", () => {
  originPoint = null;
  locationAccuracyMeters = null;
  outsideConfirmed = false;
  resetRouteResults();
  originPointBox.hidden = true;
  setLocationStatus("");
  updateMarkers();
});

destinationInput?.addEventListener("input", () => {
  destinationPoint = null;
  outsideConfirmed = false;
  resetRouteResults();
  destinationPointBox.hidden = true;
  updateMarkers();
});

selectPickupButton?.addEventListener("click", () => {
  activePoint = "pickup";
  routeLookupStatus.textContent = "Tap the map or drag the pickup marker.";
});

selectDestinationButton?.addEventListener("click", () => {
  activePoint = "destination";
  routeLookupStatus.textContent = "Tap the map or drag the destination marker.";
});

pickPickupOnMapButton?.addEventListener("click", () => openLocationPicker("pickup"));
pickDestinationOnMapButton?.addEventListener("click", () => openLocationPicker("destination"));

confirmOutsideButton?.addEventListener("click", () => {
  outsideConfirmed = true;
  showCampusWarning();
  scheduleRouteRecalculation();
});

document.querySelectorAll(".vehicle-option").forEach(option => {
  option.addEventListener("click", () => {
    if (routeDistanceKm === null) return;
    chosenVehicle = option.dataset.vehicle;
    document.querySelectorAll(".vehicle-option").forEach(item => {
      item.setAttribute("aria-checked", String(item === option));
      item.classList.toggle("selected", item === option);
    });
    updateFares();
    selectedVehicle.textContent = chosenVehicle;
    updateBookButtonState();
  });
});

form?.addEventListener("submit", async event => {
  event.preventDefault();
  setError("");
  setBookingError("");
  if (!form.reportValidity()) {
    setError("Please complete all required fields correctly.");
    return;
  }

  const originText = originInput.value.trim();
  const destinationText = destinationInput.value.trim();
  if (!originText || !destinationText) {
    setError("Please enter both pickup and destination locations.");
    return;
  }

  routeSubmitButton.disabled = true;
  routeSubmitButton.textContent = "Finding locations...";

  try {
    const pickup = originPoint || await searchCampusPlace(originText);
    const destination = destinationPoint || await searchCampusPlace(destinationText);
    if (!isValidPoint(pickup) || !isValidPoint(destination)) {
      throw new Error("Choose valid pickup and destination locations.");
    }
    writeRouteSession(pickup, destination);
    routeSubmitButton.textContent = "Opening route results...";
    window.location.assign("transport-results.html");
  } catch (error) {
    console.error("Location lookup failed:", error);
    setError(error.message || "Could not find that campus location.");
  } finally {
    routeSubmitButton.disabled = false;
    routeSubmitButton.innerHTML = 'Find route and fare <span aria-hidden="true">→</span>';
  }
});

bookNowButton?.addEventListener("click", async () => {
  if (!originPoint || !destinationPoint || routeDistanceKm === null || !chosenVehicle || submittingBooking) return;
  if (!currentCustomer) {
    setBookingError("Sign in with a customer account before submitting a transport request.");
    return;
  }
  if (typeof currentCustomer.fullName !== "string" || !currentCustomer.fullName.trim()) {
    setBookingError("Your customer profile has no saved name. Update your account profile before booking.");
    return;
  }
  if (!window.sevaFirestore || !window.firebase) {
    setBookingError("Firebase is unavailable. Please refresh and try again.");
    return;
  }
  if ((originPoint && !isWithinApproximateCampus(originPoint)) && !outsideConfirmed) {
    showCampusWarning();
    setBookingError("Confirm or change the outside-campus point before booking.");
    return;
  }
  if ((destinationPoint && !isWithinApproximateCampus(destinationPoint)) && !outsideConfirmed) {
    showCampusWarning();
    setBookingError("Confirm or change the outside-campus point before booking.");
    return;
  }

  const customerName = currentCustomer.fullName.trim();
  const perKmRate = chosenVehicle === "Bike" ? 5 : 10;
  const estimatedFare = routeDistanceKm * perKmRate;

  submittingBooking = true;
  bookNowButton.disabled = true;
  bookNowButton.textContent = "Saving booking...";
  bookingStatus.textContent = "Saving to Firebase...";
  setBookingError("");
  transportSuccess.hidden = true;

  try {
    await window.sevaFirestore.collection("transportBookings").add({
      service: "transport",
      campus: "Gautam Buddha University, Greater Noida",
      customerUid: currentCustomer.uid,
      customerEmailAddress: currentCustomer.emailAddress,
      customerMobileNumber: currentCustomer.mobileNumber,
      originLabel: originPoint.label,
      destinationLabel: destinationPoint.label,
      originCoordinates: { latitude: originPoint.latitude, longitude: originPoint.longitude },
      destinationCoordinates: { latitude: destinationPoint.latitude, longitude: destinationPoint.longitude },
      origin: originPoint.label,
      destination: destinationPoint.label,
      customerName,
      routeDistanceKm,
      selectedVehicleType: chosenVehicle,
      perKmRate,
      estimatedFare,
      status: "pending",
      createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
    });

    try {
      window.sessionStorage.removeItem(routeSessionKey);
    } catch (storageError) {
      console.warn("Could not clear the completed transport route session:", storageError);
    }
    bookingStatus.textContent = "";
    transportSuccess.hidden = false;
    transportSuccessText.textContent = `Your ${chosenVehicle} request from ${originPoint.label} to ${destinationPoint.label} was saved in Firebase. It has not been delivered to or accepted by a provider because the provider request inbox is not configured yet.`;
  } catch (error) {
    console.error("Transport booking write failed:", error);
    submittingBooking = false;
    bookNowButton.disabled = false;
    bookNowButton.innerHTML = 'Book now <span aria-hidden="true">→</span>';
    bookingStatus.textContent = "";
    setBookingError(error?.code === "permission-denied"
      ? "The booking was rejected by Firebase. Confirm the transportBookings Firestore rules."
      : "We could not save the booking. Check your connection and try again.");
  }
});

function restoreFormLocations() {
  if (!form) return;
  const request = readRouteSession();
  if (!request) return;
  setPoint("pickup", request.origin);
  setPoint("destination", request.destination);
}

function loadResultsFromSession() {
  if (!isResultsPage) return;
  const request = readRouteSession();
  if (!request) {
    routePageError.hidden = false;
    results.hidden = true;
    return;
  }

  routePageError.hidden = true;
  originPoint = request.origin;
  destinationPoint = request.destination;
  locationAccuracyMeters = originPoint.accuracyMeters || null;
  results.hidden = false;
  routeOrigin.textContent = originPoint.label;
  routeDestination.textContent = destinationPoint.label;
  originCoordinatesLabel.textContent = formatCoordinates(originPoint);
  destinationCoordinatesLabel.textContent = formatCoordinates(destinationPoint);
  recalculateRoute();
}

if (isResultsPage) {
  if (!window.firebase?.auth || !window.sevaFirestore) {
    customerAuthStatus.textContent = "Firebase could not initialize. Sign-in, live availability, and booking are unavailable.";
    availabilityNote.textContent = "Live provider availability could not be loaded.";
  } else {
    window.firebase.auth().onAuthStateChanged(user => {
      loadCustomerProfile(user);
    }, error => {
      console.error("Could not verify the customer sign-in:", error);
      customerAuthStatus.textContent = "We could not verify your sign-in. Refresh the page and try again.";
    });
  }
}

restoreFormLocations();
loadResultsFromSession();
