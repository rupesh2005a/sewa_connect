const form = document.querySelector("#transportForm");
const useLocationButton = document.querySelector("#useLocation");
const originInput = document.querySelector("#origin");
const destinationInput = document.querySelector("#destination");
const locationStatus = document.querySelector("#locationStatus");
const routeSubmitButton = document.querySelector("#transportSubmit");
const errorMessage = document.querySelector("#transportError");
const results = document.querySelector("#transportResults");
const routeLookupStatus = document.querySelector("#routeLookupStatus");
const routeOrigin = document.querySelector("#routeOrigin");
const routeDestination = document.querySelector("#routeDestination");
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

let originCoordinates = null;
let routeDistanceKm = null;
let chosenVehicle = null;
let routeDetails = null;
let map = null;
let routeLayer = null;
let submittingBooking = false;

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

function resetRouteResults() {
  routeDistanceKm = null;
  chosenVehicle = null;
  routeDetails = null;
  bookNowButton.disabled = true;
  selectedVehicle.textContent = "None";
  selectedFare.textContent = "—";
  routeDistance.textContent = "Calculating...";
  bikeFare.textContent = "—";
  carFare.textContent = "—";
  bikeDistance.textContent = "Distance unavailable";
  carDistance.textContent = "Distance unavailable";
  document.querySelectorAll(".vehicle-option").forEach(option => option.setAttribute("aria-checked", "false"));
  setBookingError("");
  bookingStatus.textContent = "";
  transportSuccess.hidden = true;
}

async function geocodeLocation(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: { "Accept-Language": "en" }
  });

  if (!response.ok) throw new Error("Location lookup failed.");

  const matches = await response.json();
  if (!matches.length) throw new Error(`Could not find "${query}". Please enter a more specific location.`);

  return {
    latitude: Number(matches[0].lat),
    longitude: Number(matches[0].lon),
    displayName: matches[0].display_name
  };
}

async function calculateRoute(origin, destination) {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`;
  const response = await fetch(url);

  if (!response.ok) throw new Error("Route calculation failed.");

  const data = await response.json();
  if (data.code !== "Ok" || !data.routes?.length) throw new Error("A route could not be found for these locations.");

  return {
    distanceMeters: data.routes[0].distance,
    geometry: data.routes[0].geometry
  };
}

function updateMap(origin, destination, geometry) {
  if (!window.L) throw new Error("The map could not be loaded.");

  if (!map) {
    map = L.map("routeMap").setView([origin.latitude, origin.longitude], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);
  }

  if (routeLayer) routeLayer.remove();
  map.eachLayer(layer => {
    if (layer instanceof L.Marker) layer.remove();
  });

  L.marker([origin.latitude, origin.longitude]).addTo(map).bindPopup("Origin");
  L.marker([destination.latitude, destination.longitude]).addTo(map).bindPopup("Destination");
  routeLayer = L.geoJSON(geometry, {
    style: { color: "#176b48", weight: 5, opacity: 0.85 }
  }).addTo(map);

  map.fitBounds(routeLayer.getBounds(), { padding: [32, 32] });
  setTimeout(() => map.invalidateSize(), 100);
}

function updateFares() {
  if (routeDistanceKm === null) return;

  const bikeTotal = routeDistanceKm * 5;
  const carTotal = routeDistanceKm * 10;

  bikeFare.textContent = `₹${Math.round(bikeTotal)}`;
  carFare.textContent = `₹${Math.round(carTotal)}`;
  bikeDistance.textContent = `${routeDistanceKm.toFixed(2)} km × ₹5/km`;
  carDistance.textContent = `${routeDistanceKm.toFixed(2)} km × ₹10/km`;

  if (chosenVehicle === "Bike") {
    selectedVehicle.textContent = "Bike";
    selectedFare.textContent = `₹${Math.round(bikeTotal)} estimated`;
  } else if (chosenVehicle === "Car") {
    selectedVehicle.textContent = "Car";
    selectedFare.textContent = `₹${Math.round(carTotal)} estimated`;
  }
}

useLocationButton?.addEventListener("click", () => {
  setLocationStatus("");
  setError("");

  if (!navigator.geolocation) {
    setLocationStatus("Location detection is unavailable. Please enter your starting location manually.", true);
    return;
  }

  useLocationButton.disabled = true;
  useLocationButton.textContent = "Getting location...";

  navigator.geolocation.getCurrentPosition(
    position => {
      const { latitude, longitude } = position.coords;
      originCoordinates = { latitude, longitude };
      originInput.value = `My current location (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`;
      setLocationStatus("Current location added. You can edit it before submitting.");
      useLocationButton.disabled = false;
      useLocationButton.innerHTML = '<span aria-hidden="true">◎</span> Use my current location';
    },
    error => {
      let message = "We could not access your location. Enter your starting location manually.";
      if (error.code === error.PERMISSION_DENIED) message = "Location permission was denied. Enter your starting location manually.";
      else if (error.code === error.POSITION_UNAVAILABLE) message = "Your location is currently unavailable. Enter your starting location manually.";
      else if (error.code === error.TIMEOUT) message = "Location detection timed out. Enter your starting location manually.";

      setLocationStatus(message, true);
      useLocationButton.disabled = false;
      useLocationButton.innerHTML = '<span aria-hidden="true">◎</span> Use my current location';
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
  );
});

originInput?.addEventListener("input", () => {
  originCoordinates = null;
  setLocationStatus("");
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

  const formData = new FormData(form);
  const originText = String(formData.get("origin") || "").trim();
  const destinationText = String(formData.get("destination") || "").trim();

  if (!originText || !destinationText) {
    setError("Please enter both an origin and destination.");
    return;
  }

  resetRouteResults();
  routeLookupStatus.textContent = "Calculating route...";
  routeSubmitButton.disabled = true;
  routeSubmitButton.textContent = "Calculating route...";
  results.hidden = false;
  routeOrigin.textContent = originText;
  routeDestination.textContent = destinationText;

  try {
    const destination = await geocodeLocation(destinationText);
    let origin;

    if (originCoordinates) {
      origin = originCoordinates;
    } else {
      origin = await geocodeLocation(originText);
    }

    const route = await calculateRoute(origin, destination);
    routeDistanceKm = route.distanceMeters / 1000;
    routeDetails = route;

    routeDistance.textContent = `${routeDistanceKm.toFixed(2)} km`;
    routeLookupStatus.textContent = "Route calculated successfully.";
    updateFares();
    updateMap(origin, destination, route.geometry);

    document.querySelector("#bikeAvailability").textContent = "Unavailable";
    document.querySelector("#carAvailability").textContent = "Unavailable";
  } catch (error) {
    console.error("Route lookup failed:", error);
    routeLookupStatus.textContent = error.message || "Route lookup failed. Please check both locations and try again.";
    routeDistance.textContent = "Unavailable";
  } finally {
    routeSubmitButton.disabled = false;
    routeSubmitButton.innerHTML = 'Find route and fares <span aria-hidden="true">→</span>';
  }

  results.scrollIntoView({ behavior: "smooth", block: "start" });
});

bookNowButton?.addEventListener("click", async () => {
  if (routeDistanceKm === null || !chosenVehicle || submittingBooking) return;

  if (!window.sevaFirestore || !window.firebase) {
    setBookingError("Firebase is unavailable. Please refresh and try again.");
    return;
  }

  const formData = new FormData(form);
  const originText = String(formData.get("origin") || "").trim();
  const destinationText = String(formData.get("destination") || "").trim();
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
      origin: originText,
      destination: destinationText,
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
    transportSuccessText.textContent = `Your ${chosenVehicle} transport booking from ${originText} to ${destinationText} was saved successfully.`;
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
