const loginForm = document.querySelector("#providerLoginPanel");
const signupForm = document.querySelector("#providerSignupPanel");
const loginTab = document.querySelector("#providerLoginTab");
const signupTab = document.querySelector("#providerSignupTab");
const title = document.querySelector("#providerAuthTitle");
const intro = document.querySelector("#providerAuthIntro");
const message = document.querySelector("#providerAuthMessage");
let actionPending = false;
let authStateReady = false;

function showMessage(text = "", isError = true) {
  message.textContent = text;
  message.hidden = !text;
  message.classList.toggle("error", isError);
  message.classList.toggle("success", !isError);
}

function setLoading(form, loading, label) {
  const button = form.querySelector('button[type="submit"]');
  if (!button) return;
  button.disabled = loading || !authStateReady;
  button.textContent = loading ? "Please wait..." : label;
}

function setReady(isReady) {
  authStateReady = isReady;
  loginForm.querySelector('button[type="submit"]').disabled = !isReady;
  signupForm.querySelector('button[type="submit"]').disabled = !isReady;
}

function setMode(mode) {
  const isLogin = mode === "login";
  loginForm.hidden = !isLogin;
  signupForm.hidden = isLogin;
  loginForm.classList.toggle("active", isLogin);
  signupForm.classList.toggle("active", !isLogin);
  loginTab.classList.toggle("active", isLogin);
  signupTab.classList.toggle("active", !isLogin);
  loginTab.setAttribute("aria-selected", String(isLogin));
  signupTab.setAttribute("aria-selected", String(!isLogin));
  title.textContent = isLogin ? "Welcome back" : "Create your provider account";
  intro.textContent = isLogin
    ? "Log in with the email and password for your provider account."
    : "Add your contact and vehicle details to join Seva Connect.";
  showMessage();
}

function authErrorText(error) {
  switch (error?.code) {
    case "auth/user-not-found":
      return "Provider account not found. Please sign up first.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Provider account not found or password is incorrect. If you have not joined, sign up as a provider.";
    case "auth/email-already-in-use":
      return "An account already uses this email. Log in with it instead.";
    case "auth/weak-password":
      return "Choose a stronger password with at least 8 characters.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a little and try again.";
    case "auth/operation-not-allowed":
    case "auth/configuration-not-found":
      return "Email/password sign-in is not enabled in Firebase Authentication.";
    case "auth/network-request-failed":
      return "Could not reach Firebase. Check your internet connection and try again.";
    default:
      return "We could not complete that request. Please try again.";
  }
}

async function getProviderProfile(uid) {
  const snapshot = await window.sevaFirestore.collection("providers").doc(uid).get();
  if (!snapshot.exists || snapshot.data().role !== "provider") return null;
  return snapshot.data();
}

async function signOutAfterProviderCheck() {
  try {
    await window.firebase.auth().signOut();
  } catch (error) {
    console.error("Could not clear a non-provider sign-in:", error);
  }
}

loginTab.addEventListener("click", () => setMode("login"));
signupTab.addEventListener("click", () => setMode("signup"));

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  showMessage();
  if (!authStateReady || !loginForm.reportValidity()) return;

  const formData = new FormData(loginForm);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  actionPending = true;
  setLoading(loginForm, true, "Log in →");

  try {
    let user;
    try {
      const credential = await window.firebase.auth().signInWithEmailAndPassword(email, password);
      user = credential.user;
    } catch (error) {
      showMessage(authErrorText(error));
      return;
    }

    let profile;
    try {
      profile = await getProviderProfile(user.uid);
    } catch (error) {
      console.error("Could not verify the provider profile:", error);
      await signOutAfterProviderCheck();
      showMessage(error?.code === "permission-denied"
        ? "Firebase rules did not allow this provider profile check. Publish the current Firestore rules and try again."
        : "We could not verify your provider profile. Check your connection and try again.");
      return;
    }

    if (!profile) {
      await signOutAfterProviderCheck();
      showMessage("Provider account not found. Please sign up as a provider first.");
      return;
    }

    window.location.replace("sewa.html");
  } finally {
    actionPending = false;
    setLoading(loginForm, false, "Log in →");
  }
});

signupForm.addEventListener("submit", async event => {
  event.preventDefault();
  showMessage();
  if (!authStateReady || !signupForm.reportValidity()) return;

  const formData = new FormData(signupForm);
  const fullName = String(formData.get("fullName") || "").trim();
  const mobileNumber = String(formData.get("mobileNumber") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  actionPending = true;
  setLoading(signupForm, true, "Create provider account →");

  let user;
  try {
    const credential = await window.firebase.auth().createUserWithEmailAndPassword(email, password);
    user = credential.user;
    await window.sevaFirestore.collection("providers").doc(user.uid).set({
      role: "provider",
      fullName,
      mobileNumber,
      emailAddress: email,
      createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
    });
    window.location.replace("sewa.html");
  } catch (error) {
    if (user) {
      try {
        await user.delete();
      } catch (rollbackError) {
        console.error("Could not roll back an incomplete provider signup:", rollbackError);
        showMessage("Your login account was created, but the provider profile could not be saved. Contact support before trying again.");
        actionPending = false;
        setLoading(signupForm, false, "Create provider account →");
        return;
      }
    }
    console.error("Provider signup failed:", error);
    showMessage(error?.code === "permission-denied"
      ? "Firebase rejected the provider profile. Publish the current Firestore rules and try again."
      : authErrorText(error));
  } finally {
    actionPending = false;
    setLoading(signupForm, false, "Create provider account →");
  }
});

if (!window.firebase?.auth || !window.sevaFirestore) {
  showMessage("Firebase could not initialize. Check the Firebase scripts and project configuration.");
} else {
  window.firebase.auth().onAuthStateChanged(async user => {
    if (actionPending) return;
    if (!user) {
      setReady(true);
      return;
    }

    actionPending = true;
    try {
      const profile = await getProviderProfile(user.uid);
      if (profile) {
        window.location.replace("sewa.html");
        return;
      }
      await signOutAfterProviderCheck();
      showMessage("Provider account not found for this signed-in user. Log in with a provider account or sign up.");
    } catch (error) {
      console.error("Could not check the signed-in provider:", error);
      await signOutAfterProviderCheck();
      showMessage("We could not verify this provider account. Check your connection and try again.");
    } finally {
      actionPending = false;
      setReady(true);
    }
  }, error => {
    console.error("Could not read the authentication state:", error);
    showMessage("We could not verify your sign-in. Refresh the page and try again.");
  });
}
