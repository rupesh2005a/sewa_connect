const form = document.querySelector("#transportForm");
const originInput = document.querySelector("#origin");
const destinationInput = document.querySelector("#destination");
const campusLocationsList = document.querySelector("#campusLocations");
const useLocationButton = document.querySelector("#useLocation");
const locationStatus = document.querySelector("#locationStatus");
const originPointBox = document.querySelector("#originPoint");
const destinationPointBox = document.querySelector("#destinationPoint");
const routeSubmitButton = document.querySelector("#transportSubmit");
const errorMessage = document.querySelector("#transportError");
const results = document.querySelector("#transportResults");
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
let accuracyCircle = null;
let locationAccuracyMeters = null;
let submittingBooking = false;
let routeTimer = null;
let searchTimers = new WeakMap();
const placeCache = new Map();

function setError(message = "") {
  errorMessage.textContent = message;
  errorMessage.hidden = !message;
}

function setBookingError(message = "") {
  bookingError.textContent = message;
  bookingError.hidden = !message;
}

function setLocationStatus(message = "", isError = false) {
  locationStatus.textContent = message;
  locationStatus.classList.toggle("error", isError);
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

function isWithinApproximateCampus(point) {
  return point.latitude <= campusBounds.north &&
    point.latitude >= campusBounds.south &&
    point.longitude <= campusBounds.east &&
    point.longitude >= campusBounds.west;
}

function showCampusWarning() {
  const outside = (originPoint && !isWithinApproximateCampus(originPoint)) ||
    (destinationPoint && !isWithinApproximateCampus(destinationPoint));
  outsideWarning.hidden = !outside;
  confirmOutsideButton.hidden = !outside;
  confirmOutsideButton.textContent = outsideConfirmed
    ? "Outside-campus point confirmed"
    : "Confirm point outside campus";
  confirmOutsideButton.disabled = outsideConfirmed;
  return outside;
}

async function searchCampusPlace(query) {
  if (!query || query.trim().length < 3) {
    throw new Error("Enter at least 3 characters to search.");
  }

  const cachedPoint = placeCache.get(query.trim().toLowerCase());
  if (cachedPoint) return cachedPoint;

  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(`${query}, Gautam Buddha University, Greater Noida`)}&limit=5&lat=${campusCenter.latitude}&lon=${campusCenter.longitude}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Place search is unavailable. Use the map or drag a marker.");

  const data = await response.json();
  const features = (data.features || []).filter(feature => {
    const coordinates = feature.geometry?.coordinates;
    if (!coordinates) return false;
    return isWithinApproximateCampus({
      latitude: coordinates[1],
      longitude: coordinates[0]
    });
  });

  if (locationAccuracyMeters) {
    accuracyCircle = L.circle([originPoint.latitude, originPoint.longitude], {
      radius: locationAccuracyMeters,
      color: "#176b48",
      weight: 1,
      fillColor: "#176b48",
      fillOpacity: 0.12
    }).addTo(map);
  }

  if (!features.length) {
    throw new Error(`No verified campus-area result for "${query}". Tap the map or drag a marker instead.`);
  }

  const properties = features[0].properties || {};
  const [longitude, latitude] = features[0].geometry.coordinates;
  const labelParts = [properties.name, properties.street, properties.district, properties.city].filter(Boolean);
  const point = {
    latitude,
    longitude,
    label: [...new Set(labelParts)].join(", ") || query
  };
  placeCache.set(query.trim().toLowerCase(), point);
  return point;
}

function searchPlaceSuggestions(input) {
  input.addEventListener("input", () => {
    clearTimeout(searchTimers.get(input));
    const query = input.value.trim();
    if (query.length < 3) return;

    const timer = setTimeout(async () => {
      try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(`${query}, Gautam Buddha University, Greater Noida`)}&limit=8&lat=${campusCenter.latitude}&lon=${campusCenter.longitude}`;
        const response = await fetch(url);
        if (!response.ok) return;
        const data = await response.json();

        campusLocationsList.replaceChildren();
        (data.features || []).forEach(feature => {
          const coordinates = feature.geometry?.coordinates;
          if (!coordinates) return;
          const point = { latitude: coordinates[1], longitude: coordinates[0] };
          if (!isWithinApproximateCampus(point)) return;

          const properties = feature.properties || {};
          const label = [properties.name, properties.street, properties.district, properties.city]
            .filter(Boolean)
            .filter((part, index, values) => values.indexOf(part) === index)
            .join(", ");
          if (!label) return;
          const option = document.createElement("option");
          option.value = label;
          campusLocationsList.append(option);
          placeCache.set(label.toLowerCase(), {
            ...point,
            label
          });
        });
      } catch (error) {
        console.warn("Campus place suggestions are unavailable:", error);
      }
    }, 350);

    searchTimers.set(input, timer);
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
  if (!Number.isFinite(data.routes[0].distance) || data.routes[0].distance <= 0) {
    throw new Error("Pickup and destination need to be different valid locations.");
  }

  return {
    distanceMeters: data.routes[0].distance,
    geometry: data.routes[0].geometry
  };
}

function initializeMap() {
  if (!window.L) throw new Error("The map could not be loaded.");
  if (map) return;

  map = L.map("routeMap").setView([campusCenter.latitude, campusCenter.longitude], 15);
  const basemap = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    subdomains: "abcd",
    maxZoom: 20
  }).addTo(map);

  basemap.on("tileerror", () => {
    routeLookupStatus.textContent = "Map tiles could not be loaded. Route and fare may still be available; check your connection.";
  });

  L.rectangle([
    [campusBounds.south, campusBounds.west],
    [campusBounds.north, campusBounds.east]
  ], {
    color: "#176b48",
    weight: 1,
    opacity: 0.55,
    fillOpacity: 0.03,
    dashArray: "5 5"
  }).addTo(map);

  map.on("click", event => {
    const point = {
      latitude: event.latlng.lat,
      longitude: event.latlng.lng,
      label: `Map-selected ${activePoint === "pickup" ? "pickup" : "destination"} point`
    };
    setPoint(activePoint, point);
  });

  requestAnimationFrame(() => map.invalidateSize());
}

function setPoint(type, point) {
  outsideConfirmed = false;
  if (type === "pickup") {
    originPoint = point;
    locationAccuracyMeters = point.accuracyMeters || null;
    originInput.value = point.label;
    updatePointBox(originPointBox, point);
  } else {
    destinationPoint = point;
    destinationInput.value = point.label;
    updatePointBox(destinationPointBox, point);
  }

  updateMarkers();
  showCampusWarning();
  scheduleRouteRecalculation();
}

function updateMarkers() {
  if (!map) return;
  if (originMarker) originMarker.remove();
  if (destinationMarker) destinationMarker.remove();
  if (accuracyCircle) accuracyCircle.remove();

  if (originPoint) {
    originMarker = L.marker([originPoint.latitude, originPoint.longitude], { draggable: true })
      .addTo(map)
      .bindPopup("Pickup — drag to adjust");
    originMarker.on("dragend", event => {
      const position = event.target.getLatLng();
      setPoint("pickup", {
        latitude: position.lat,
        longitude: position.lng,
        label: "Dragged pickup point"
      });
    });
  }

  if (destinationPoint) {
    destinationMarker = L.marker([destinationPoint.latitude, destinationPoint.longitude], {
      draggable: true,
      icon: L.icon({
        iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34]
      })
    }).addTo(map).bindPopup("Destination — drag to adjust");

    destinationMarker.on("dragend", event => {
      const position = event.target.getLatLng();
      setPoint("destination", {
        latitude: position.lat,
        longitude: position.lng,
        label: "Dragged destination point"
      });
    });
  }
}

function resetRouteResults() {
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
  if (routeLayer) routeLayer.remove();
  routeLayer = null;
}

function updateFares() {
  if (routeDistanceKm === null) return;

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

  resetRouteResults();
  results.hidden = false;
  routeLookupStatus.textContent = "Calculating route...";
  routeOrigin.textContent = originPoint.label;
  routeDestination.textContent = destinationPoint.label;
  originCoordinatesLabel.textContent = formatCoordinates(originPoint);
  destinationCoordinatesLabel.textContent = formatCoordinates(destinationPoint);

  const outside = showCampusWarning();
  if (outside && !outsideConfirmed) {
    routeLookupStatus.textContent = "Point outside the approximate campus boundary. Confirm or change it.";
    routeDistance.textContent = "Unavailable";
    return;
  }

  try {
    const route = await calculateRoute(originPoint, destinationPoint);
    routeDistanceKm = route.distanceMeters / 1000;
    routeDistance.textContent = `${routeDistanceKm.toFixed(2)} km`;
    routeLookupStatus.textContent = "Route calculated successfully.";
    updateFares();

    initializeMap();
    updateMarkers();
    if (routeLayer) routeLayer.remove();
    routeLayer = L.geoJSON(route.geometry, {
      style: { color: "#176b48", weight: 5, opacity: 0.85 }
    }).addTo(map);
    map.fitBounds(routeLayer.getBounds(), { padding: [32, 32] });
    setTimeout(() => map.invalidateSize(), 100);
  } catch (error) {
    console.error("Route lookup failed:", error);
    routeLookupStatus.textContent = error.message || "Route lookup failed.";
    routeDistance.textContent = "Unavailable";
  }
}

function scheduleRouteRecalculation() {
  clearTimeout(routeTimer);
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
        label: "My GPS-reported pickup location"
      };
      setPoint("pickup", point);
      const accuracyText = Number.isFinite(accuracy)
        ? ` Reported accuracy radius: about ${Math.round(accuracy)} metres.`
        : "";
      setLocationStatus(`Pickup updated with high-accuracy geolocation.${accuracyText}`);
      useLocationButton.disabled = false;
      useLocationButton.innerHTML = '<span aria-hidden="true">◎</span> Use my current location';
      results.hidden = false;
      initializeMap();
      updateMarkers();
      map.setView([point.latitude, point.longitude], 16);
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

searchPlaceSuggestions(originInput);
searchPlaceSuggestions(destinationInput);

originInput?.addEventListener("input", () => {
  originPoint = null;
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
    bookNowButton.disabled = false;
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
  results.hidden = false;

  try {
    initializeMap();
    if (!originPoint) originPoint = await searchCampusPlace(originText);
    if (!destinationPoint) destinationPoint = await searchCampusPlace(destinationText);
    updatePointBox(originPointBox, originPoint);
    updatePointBox(destinationPointBox, destinationPoint);
    updateMarkers();
    await recalculateRoute();
  } catch (error) {
    console.error("Location lookup failed:", error);
    setError(error.message || "Could not find that campus location.");
  } finally {
    routeSubmitButton.disabled = false;
    routeSubmitButton.innerHTML = 'Find route and fares <span aria-hidden="true">→</span>';
  }

  results.scrollIntoView({ behavior: "smooth", block: "start" });
});

bookNowButton?.addEventListener("click", async () => {
  if (!originPoint || !destinationPoint || routeDistanceKm === null || !chosenVehicle || submittingBooking) return;
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

  const formData = new FormData(form);
  const customerName = String(formData.get("customerName") || "").trim();
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

    bookingStatus.textContent = "";
    transportSuccess.hidden = false;
    transportSuccessText.textContent = `Your ${chosenVehicle} transport booking from ${originPoint.label} to ${destinationPoint.label} was saved successfully.`;
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
