const servicesForm = document.querySelector("#servicesForm");
const servicesLoading = document.querySelector("#servicesLoading");
const servicesMessage = document.querySelector("#servicesMessage");
const servicesRetry = document.querySelector("#servicesRetry");
const proceedButton = document.querySelector("#proceedButton");
const providerSignOut = document.querySelector("#providerSignOut");
const providerIdentity = document.querySelector("#providerIdentity");
const allowedServices = [
  "Transport",
  "Agriculture & equipment",
  "Repair & maintenance",
  "Home service",
  "Construction",
  "Other local services"
];
let currentProvider = null;
let currentProfile = null;
let profileLoadPending = false;

function showMessage(text = "", isError = true) {
  servicesMessage.textContent = text;
  servicesMessage.hidden = !text;
  servicesMessage.classList.toggle("error", isError);
  servicesMessage.classList.toggle("success", !isError);
}

function updateSelectionState() {
  const checkboxes = [...servicesForm.querySelectorAll('input[name="services"]')];
  const selected = checkboxes.filter(input => input.checked).map(input => input.value);
  checkboxes.forEach(input => {
    input.closest(".provider-service-option").classList.toggle("selected", input.checked);
  });
  proceedButton.disabled = selected.length === 0;
  return selected;
}

function showLoadError(text) {
  servicesLoading.hidden = true;
  servicesForm.hidden = true;
  servicesRetry.hidden = false;
  showMessage(text);
}

async function loadProviderServices(user) {
  if (profileLoadPending) return;
  profileLoadPending = true;
  currentProvider = user;
  servicesLoading.hidden = false;
  servicesLoading.textContent = "Loading your provider profile…";
  servicesRetry.hidden = true;
  servicesForm.hidden = true;
  showMessage();

  try {
    const snapshot = await window.sevaFirestore.collection("providers").doc(user.uid).get();
    if (!snapshot.exists || snapshot.data().role !== "provider") {
      window.location.replace("provider-auth.html");
      return;
    }

    const profile = snapshot.data();
    currentProfile = profile;
    providerIdentity.textContent = profile.fullName || user.email || "Provider account";
    const savedServices = Array.isArray(profile.services)
      ? profile.services.filter(service => allowedServices.includes(service))
      : [];
    servicesForm.querySelectorAll('input[name="services"]').forEach(input => {
      input.checked = savedServices.includes(input.value);
    });

    servicesLoading.hidden = true;
    servicesForm.hidden = false;
    updateSelectionState();
  } catch (error) {
    console.error("Could not load the provider service selections:", error);
    showLoadError(error?.code === "permission-denied"
      ? "Firebase rules did not allow this provider profile lookup. Publish the current rules and try again."
      : "We could not load your provider profile. Check your connection and try again.");
  } finally {
    profileLoadPending = false;
  }
}

servicesForm.addEventListener("change", () => {
  showMessage();
  updateSelectionState();
});

servicesForm.addEventListener("submit", async event => {
  event.preventDefault();
  const selectedServices = updateSelectionState();
  if (!currentProvider || selectedServices.length === 0) return;

  const hasTransport = selectedServices.includes("Transport");
  const hasTransportDetails = currentProfile?.transportDetails?.service === "Transport";
  const onboardingComplete = !hasTransport || hasTransportDetails;
  proceedButton.disabled = true;
  proceedButton.textContent = "Saving your services…";
  showMessage();
  try {
    await window.sevaFirestore.collection("providers").doc(currentProvider.uid).update({
      services: selectedServices,
      onboardingComplete
    });
    const nextPage = hasTransport
      ? hasTransportDetails ? "provider-availability.html" : "transport-provider.html"
      : "provider-dashboard.html";
    showMessage("Your services were saved. Continuing to the next step…", false);
    window.setTimeout(() => window.location.replace(nextPage), 700);
  } catch (error) {
    console.error("Could not save provider services:", error);
    showMessage(error?.code === "permission-denied"
      ? "Firebase rules did not allow saving these services. Publish the current Firestore rules and try again."
      : "We could not save your services. Check your connection and try again.");
    proceedButton.disabled = false;
    proceedButton.innerHTML = 'Proceed <span aria-hidden="true">→</span>';
  }
});

servicesRetry.addEventListener("click", () => {
  if (currentProvider) loadProviderServices(currentProvider);
});

providerSignOut.addEventListener("click", async () => {
  providerSignOut.disabled = true;
  try {
    await window.firebase.auth().signOut();
    window.location.replace("provider-auth.html");
  } catch (error) {
    console.error("Provider sign-out failed:", error);
    providerSignOut.disabled = false;
    showMessage("We could not sign you out. Please try again.");
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
    loadProviderServices(user);
  }, error => {
    console.error("Could not verify the provider sign-in:", error);
    showLoadError("We could not verify your sign-in. Please refresh the page.");
  });
}
