const dashboardStatus = document.querySelector("#dashboardStatus");
const dashboardError = document.querySelector("#dashboardError");
const dashboardContent = document.querySelector("#dashboardContent");
const dashboardServices = document.querySelector("#dashboardServices");
const transportDetailsLink = document.querySelector("#transportDetailsLink");
const providerAvailabilityLink = document.querySelector("#providerAvailabilityLink");
const providerIdentity = document.querySelector("#providerIdentity");
const providerSignOut = document.querySelector("#providerSignOut");

function showDashboardError(text) {
  dashboardStatus.hidden = true;
  dashboardError.textContent = text;
  dashboardError.hidden = false;
}

async function loadDashboard(user) {
  try {
    const snapshot = await window.sevaFirestore.collection("providers").doc(user.uid).get();
    if (!snapshot.exists || snapshot.data().role !== "provider") {
      window.location.replace("provider-auth.html");
      return;
    }

    const profile = snapshot.data();
    const services = Array.isArray(profile.services) ? profile.services : [];
    if (services.length === 0) {
      window.location.replace("provider-services.html");
      return;
    }

    providerIdentity.textContent = profile.fullName || user.email || "Provider account";
    const hasTransport = services.includes("Transport");
    const hasTransportDetails = profile.transportDetails?.service === "Transport";
    transportDetailsLink.hidden = !hasTransport;
    providerAvailabilityLink.hidden = !hasTransport || !hasTransportDetails;
    dashboardServices.replaceChildren(...services.map(service => {
      const item = document.createElement("li");
      item.textContent = service;
      return item;
    }));
    dashboardStatus.hidden = true;
    dashboardContent.hidden = false;
  } catch (error) {
    console.error("Could not load the provider dashboard:", error);
    showDashboardError(error?.code === "permission-denied"
      ? "Firebase rules did not allow this provider profile lookup. Publish the current rules and try again."
      : "We could not load your provider dashboard. Check your connection and try again.");
  }
}

providerSignOut.addEventListener("click", async () => {
  providerSignOut.disabled = true;
  try {
    await window.firebase.auth().signOut();
    window.location.replace("provider-auth.html");
  } catch (error) {
    console.error("Provider sign-out failed:", error);
    providerSignOut.disabled = false;
    showDashboardError("We could not sign you out. Please try again.");
  }
});

if (!window.firebase?.auth || !window.sevaFirestore) {
  showDashboardError("Firebase could not initialize. Check the Firebase scripts and project configuration.");
} else {
  window.firebase.auth().onAuthStateChanged(user => {
    if (!user) {
      window.location.replace("provider-auth.html");
      return;
    }
    loadDashboard(user);
  }, error => {
    console.error("Could not verify the provider sign-in:", error);
    showDashboardError("We could not verify your sign-in. Please refresh the page.");
  });
}
