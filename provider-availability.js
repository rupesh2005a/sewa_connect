const availabilityLoading = document.querySelector("#availabilityLoading");
const availabilityContent = document.querySelector("#availabilityContent");
const availabilityState = document.querySelector("#availabilityState");
const availabilityMessage = document.querySelector("#availabilityMessage");
const availabilityError = document.querySelector("#availabilityError");
const availabilityRetry = document.querySelector("#availabilityRetry");
const locationSummary = document.querySelector("#locationSummary");
const locationMapElement = document.querySelector("#providerLocationMap");
const goLiveButton = document.querySelector("#goLiveButton");
const useSelectedPinButton = document.querySelector("#useSelectedPinButton");
const stopSharingButton = document.querySelector("#stopSharingButton");
const providerIdentity = document.querySelector("#providerIdentity");
const providerSignOut = document.querySelector("#providerSignOut");

const campusCenter = [28.4226598, 77.5257227];
const approximateCampusExtent = {
  north: 28.4332299,
  south: 28.4121277,
  east: 77.533729,
  west: 77.5155537
};
let currentProvider = null;
let operationPending = false;
let locationMap = null;
let locationMarker = null;
let selectedLocation = null;
let availabilityUnsubscribe = null;

function showMessage(text = "", isError = false) {
  availabilityMessage.textContent = text;
  availabilityMessage.hidden = !text;
  availabilityMessage.classList.toggle("error", isError);
  availabilityMessage.classList.toggle("success", Boolean(text) && !isError);
}

function showLoadError(text) {
  availabilityLoading.hidden = true;
  availabilityContent.hidden = true;
  availabilityError.textContent = text;
  availabilityError.hidden = false;
  availabilityRetry.hidden = false;
}

function isWithinMappedExtent(latitude, longitude) {
  return latitude <= approximateCampusExtent.north &&
    latitude >= approximateCampusExtent.south &&
    longitude <= approximateCampusExtent.east &&
    longitude >= approximateCampusExtent.west;
}

function formatCoordinates(latitude, longitude) {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

function setProviderAvailability(status) {
  availabilityState.textContent = status === "available"
    ? "Your provider availability record is marked live."
    : "You are currently not sharing your location.";
}

function setSelectedLocation(latitude, longitude, source, accuracyMeters = null) {
  selectedLocation = { latitude, longitude, source, accuracyMeters };
  useSelectedPinButton.disabled = false;
  locationSummary.hidden = false;
  const accuracyText = Number.isFinite(accuracyMeters)
    ? ` GPS reported an accuracy radius of about ${Math.round(accuracyMeters)} m; this is an estimate, not a 50 m pass/fail test.`
    : " This is a manually selected map point; GPS accuracy is not available for this pin.";
  locationSummary.textContent = `${source === "gps" ? "GPS location" : "Selected map pin"}: ${formatCoordinates(latitude, longitude)}.${accuracyText} Drag the pin or tap the map to adjust it.`;

  if (locationMarker) {
    locationMarker.setLngLat([longitude, latitude]);
  } else {
    const element = document.createElement("div");
    element.className = "transport-map-marker pickup-map-marker";
    element.setAttribute("aria-label", "Your selected location");
    locationMarker = new maplibregl.Marker({ element, draggable: true })
      .setLngLat([longitude, latitude])
      .setPopup(new maplibregl.Popup({ offset: 20 }).setText("Your selected location"))
      .addTo(locationMap);
    locationMarker.on("dragend", () => {
      const point = locationMarker.getLngLat();
      setSelectedLocation(point.lat, point.lng, "manual", null);
    });
  }
  updateLocationAccuracyCircle();
  locationMap.easeTo({ center: [longitude, latitude], zoom: 17 });
}

function initializeLocationMap() {
  if (locationMap) return;
  if (!window.maplibregl) throw new Error("The location map could not be loaded.");
  locationMap = new maplibregl.Map({
    container: locationMapElement,
    style: "https://tiles.waymorphic.com/styles/positron",
    center: [campusCenter[1], campusCenter[0]],
    zoom: 15
  });
  locationMap.addControl(new maplibregl.NavigationControl(), "top-right");
  locationMap.on("load", () => {
    locationMap.addSource("provider-campus-boundary", {
      type: "geojson",
      data: campusBoundaryFeature()
    });
    locationMap.addLayer({
      id: "provider-campus-boundary-fill",
      type: "fill",
      source: "provider-campus-boundary",
      paint: { "fill-color": "#176b48", "fill-opacity": 0.03 }
    });
    locationMap.addLayer({
      id: "provider-campus-boundary-line",
      type: "line",
      source: "provider-campus-boundary",
      paint: {
        "line-color": "#176b48",
        "line-width": 1,
        "line-opacity": 0.55,
        "line-dasharray": [2, 2]
      }
    });
    updateLocationAccuracyCircle();
  });
  locationMap.on("click", event => {
    setSelectedLocation(event.lngLat.lat, event.lngLat.lng, "manual");
  });
  locationMap.on("error", event => {
    if (event.error) console.warn("The provider location map reported an error:", event.error);
  });
  window.requestAnimationFrame(() => locationMap.resize());
}

function campusBoundaryFeature() {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [[
        [approximateCampusExtent.west, approximateCampusExtent.south],
        [approximateCampusExtent.east, approximateCampusExtent.south],
        [approximateCampusExtent.east, approximateCampusExtent.north],
        [approximateCampusExtent.west, approximateCampusExtent.north],
        [approximateCampusExtent.west, approximateCampusExtent.south]
      ]]
    }
  };
}

function createAccuracyCircleFeature(latitude, longitude, radiusMeters) {
  const coordinates = [];
  const latitudeRadians = latitude * Math.PI / 180;
  for (let index = 0; index <= 64; index += 1) {
    const angle = index * 2 * Math.PI / 64;
    const circleLatitude = latitude + (radiusMeters / 111320) * Math.cos(angle);
    const circleLongitude = longitude +
      (radiusMeters / (111320 * Math.cos(latitudeRadians))) * Math.sin(angle);
    coordinates.push([circleLongitude, circleLatitude]);
  }
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [coordinates] }
  };
}

function updateLocationAccuracyCircle() {
  if (!locationMap || !locationMap.isStyleLoaded()) return;
  const data = selectedLocation && Number.isFinite(selectedLocation.accuracyMeters) &&
      selectedLocation.accuracyMeters > 0
    ? createAccuracyCircleFeature(
      selectedLocation.latitude,
      selectedLocation.longitude,
      selectedLocation.accuracyMeters
    )
    : { type: "FeatureCollection", features: [] };
  const source = locationMap.getSource("provider-location-accuracy");
  if (source) {
    source.setData(data);
    return;
  }
  locationMap.addSource("provider-location-accuracy", { type: "geojson", data });
  locationMap.addLayer({
    id: "provider-location-accuracy-fill",
    type: "fill",
    source: "provider-location-accuracy",
    paint: {
      "fill-color": "#176b48",
      "fill-opacity": 0.12,
      "fill-outline-color": "#176b48"
    }
  });
}

async function loadProviderProfile(user) {
  currentProvider = user;
  availabilityLoading.hidden = false;
  availabilityLoading.textContent = "Loading your provider profile…";
  availabilityContent.hidden = true;
  availabilityRetry.hidden = true;
  availabilityError.hidden = true;

  try {
    const snapshot = await window.sevaFirestore.collection("providers").doc(user.uid).get();
    if (!snapshot.exists || snapshot.data().role !== "provider") {
      window.location.replace("provider-auth.html");
      return;
    }

    const profile = snapshot.data();
    if (!Array.isArray(profile.services) || !profile.services.includes("Transport")) {
      window.location.replace("provider-services.html");
      return;
    }
    if (profile.transportDetails?.service !== "Transport") {
      window.location.replace("transport-provider.html");
      return;
    }

    providerIdentity.textContent = profile.fullName || user.email || "Provider account";
    const availabilitySnapshot = await window.sevaFirestore.collection("providerAvailability").doc(user.uid).get();
    setProviderAvailability(availabilitySnapshot.exists ? availabilitySnapshot.data().status : "unavailable");
    if (availabilityUnsubscribe) availabilityUnsubscribe();
    availabilityUnsubscribe = window.sevaFirestore.collection("providerAvailability").doc(user.uid)
      .onSnapshot(snapshot => {
        setProviderAvailability(snapshot.exists ? snapshot.data().status : "unavailable");
      }, error => {
        console.error("Could not monitor provider availability:", error);
        showMessage("Live availability status could not be refreshed. Check your connection.", true);
      });
    availabilityLoading.hidden = true;
    availabilityContent.hidden = false;
    try {
      initializeLocationMap();
    } catch (error) {
      console.error("Could not load the provider location map:", error);
      showMessage("The map is unavailable. You can retry location later, but live sharing remains disabled until campus verification is configured.", true);
    }
  } catch (error) {
    console.error("Could not load provider availability:", error);
    showLoadError(error?.code === "permission-denied"
      ? "Firebase rules did not allow loading your provider profile. Publish the current Firestore rules and try again."
      : "We could not load your provider profile. Check your connection and try again.");
  }
}

function handleLocationResult(position) {
  const { latitude, longitude, accuracy } = position.coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      !Number.isFinite(accuracy) || accuracy <= 0) {
    showMessage("Your device did not return a usable location fix. Try again or check your device location settings.", true);
    return;
  }

  try {
    initializeLocationMap();
  } catch (error) {
    console.error("Could not display the provider location:", error);
    showMessage("The location was received, but the map could not load it. Try again when the map is available.", true);
    return;
  }
  setSelectedLocation(latitude, longitude, "gps", accuracy);
  if (!isWithinMappedExtent(latitude, longitude)) {
    showMessage("This point is outside the approximate mapped extent. Adjust it only if the pin represents your actual location; campus verification is still required.", true);
  } else {
    showMessage("Location received. Review or adjust the pin, then check it. The app will not mark you available until the official campus boundary is configured.", true);
  }
}

function handleLocationError(error) {
  if (error.code === 1) {
    showMessage("Location permission was denied. Allow location access in your browser settings, or try again later.", true);
  } else if (error.code === 2) {
    showMessage("Your device could not determine a location. Check location services or try manual device settings, then try again.", true);
  } else if (error.code === 3) {
    showMessage("The location request timed out. Move to an area with a clearer signal and try again.", true);
  } else {
    showMessage("We could not get your location. Check your device settings and try again.", true);
  }
}

function finishLocationCheck() {
  operationPending = false;
  goLiveButton.disabled = false;
  goLiveButton.textContent = "Get my location";
}

goLiveButton.addEventListener("click", () => {
  if (operationPending) return;
  showMessage();
  locationSummary.hidden = true;

  if (!navigator.geolocation) {
    showMessage("Location is unavailable in this browser. You can still use the dashboard, but Go Live cannot continue.", true);
    return;
  }

  operationPending = true;
  goLiveButton.disabled = true;
  goLiveButton.textContent = "Getting location…";
  try {
    navigator.geolocation.getCurrentPosition(position => {
      try {
        handleLocationResult(position);
      } finally {
        finishLocationCheck();
      }
    }, error => {
      try {
        handleLocationError(error);
      } finally {
        finishLocationCheck();
      }
    }, {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    });
  } catch (error) {
    console.error("Could not start provider location check:", error);
    showMessage("Location checks require a secure website connection (HTTPS) and browser location access.", true);
    finishLocationCheck();
  }
});

useSelectedPinButton.addEventListener("click", () => {
  if (!selectedLocation || operationPending) return;
  if (!isWithinMappedExtent(selectedLocation.latitude, selectedLocation.longitude)) {
    showMessage("The selected point is outside the approximate mapped extent. Change the pin to a location inside the service area.", true);
    return;
  }
  showMessage("The pin is inside the approximate map extent, but that extent is not an authoritative campus boundary. No live status or location was saved.", true);
});

stopSharingButton.addEventListener("click", async () => {
  if (!currentProvider || operationPending) return;
  operationPending = true;
  stopSharingButton.disabled = true;
  goLiveButton.disabled = true;
  showMessage("Marking you unavailable…");

  try {
    await window.sevaFirestore.collection("providerAvailability").doc(currentProvider.uid).set({
      status: "unavailable",
      updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
    });
    setProviderAvailability("unavailable");
    locationSummary.hidden = true;
    useSelectedPinButton.disabled = true;
    showMessage("You are marked unavailable. Firebase confirmed the update.");
  } catch (error) {
    console.error("Could not mark provider unavailable:", error);
    showMessage(error?.code === "permission-denied"
      ? "Firebase rules did not allow this update. Publish the current Firestore rules and try again."
      : "We could not update your availability. Check your connection and try again.", true);
  } finally {
    operationPending = false;
    stopSharingButton.disabled = false;
    goLiveButton.disabled = false;
  }
});

availabilityRetry.addEventListener("click", () => {
  if (currentProvider) loadProviderProfile(currentProvider);
});

providerSignOut.addEventListener("click", async () => {
  providerSignOut.disabled = true;
  try {
    if (availabilityUnsubscribe) availabilityUnsubscribe();
    await window.firebase.auth().signOut();
    window.location.replace("provider-auth.html");
  } catch (error) {
    console.error("Provider sign-out failed:", error);
    providerSignOut.disabled = false;
    showMessage("We could not sign you out. Please try again.", true);
  }
});

if (!window.firebase?.auth || !window.sevaFirestore) {
  showLoadError("Firebase could not initialize. Check the Firebase scripts and project configuration.");
} else {
  window.firebase.auth().onAuthStateChanged(user => {
    if (!user) {
      window.location.replace("provider-auth.html");
      return;
    }
    loadProviderProfile(user);
  }, error => {
    console.error("Could not verify the provider sign-in:", error);
    showLoadError("We could not verify your sign-in. Please refresh the page.");
  });
}
