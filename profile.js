const profileStatus = document.querySelector("#profileStatus");
const profileError = document.querySelector("#profileError");
const profileContent = document.querySelector("#profileContent");
const profileRetry = document.querySelector("#profileRetry");
const profileSignOut = document.querySelector("#profileSignOut");
let authenticatedUser = null;

function showProfileError(message) {
  profileError.textContent = message;
  profileError.hidden = false;
  profileStatus.hidden = true;
  profileRetry.hidden = false;
}

async function loadProfile(user) {
  authenticatedUser = user;
  profileError.hidden = true;
  profileRetry.hidden = true;
  profileContent.hidden = true;
  profileStatus.hidden = false;
  profileStatus.textContent = "Loading your profile…";

  try {
    const [providerSnapshot, customerSnapshot] = await Promise.all([
      window.sevaFirestore.collection("providers").doc(user.uid).get(),
      window.sevaFirestore.collection("customers").doc(user.uid).get()
    ]);

    const profileSnapshot = providerSnapshot.exists ? providerSnapshot : customerSnapshot;
    if (!profileSnapshot.exists) {
      showProfileError("We could not find a profile linked to this account. If registration did not finish, please contact support.");
      return;
    }

    const profile = profileSnapshot.data();
    const isProvider = profile.role === "provider";
    if (!isProvider && profile.role !== "customer") {
      showProfileError("This account has an unsupported profile type. Please contact support.");
      return;
    }

    document.querySelector("#profileRole").textContent = isProvider ? "Service provider" : "Customer";
    document.querySelector("#profileName").textContent = profile.fullName || "Name not provided";
    document.querySelector("#profileEmail").textContent = profile.emailAddress || user.email || "Not provided";
    document.querySelector("#profileMobile").textContent = profile.mobileNumber || "Not provided";
    const hasVehicleDetails = Boolean(profile.vehicleNumber || profile.vehicleType);
    document.querySelector("#providerDetails").hidden = !isProvider || !hasVehicleDetails;
    if (isProvider) {
      document.querySelector("#profileVehicleNumber").textContent = profile.vehicleNumber || "Not provided";
      document.querySelector("#profileVehicleType").textContent = profile.vehicleType || "Not provided";
    }

    profileStatus.hidden = true;
    profileContent.hidden = false;
  } catch (error) {
    console.error("Could not load the signed-in user's profile:", error);
    showProfileError(error?.code === "permission-denied"
      ? "Firebase rules did not allow this profile lookup. Publish the current Firestore rules and try again."
      : "We could not load your profile. Check your connection and try again.");
  }
}

profileRetry.addEventListener("click", () => {
  if (authenticatedUser) loadProfile(authenticatedUser);
});

profileSignOut.addEventListener("click", async () => {
  profileSignOut.disabled = true;
  try {
    await window.firebase.auth().signOut();
    window.location.replace("sewa.html");
  } catch (error) {
    console.error("Profile sign-out failed:", error);
    profileSignOut.disabled = false;
    showProfileError("We could not sign you out. Please try again.");
  }
});

if (!window.firebase?.auth || !window.sevaFirestore) {
  showProfileError("Firebase could not initialize. Check the Firebase scripts and project configuration.");
} else {
  window.firebase.auth().onAuthStateChanged(user => {
    if (!user) {
      window.location.replace("auth.html");
      return;
    }
    loadProfile(user);
  }, error => {
    console.error("Could not read the authentication state:", error);
    showProfileError("We could not verify your sign-in. Please refresh the page.");
  });
}
