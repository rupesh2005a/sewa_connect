const loginForm = document.querySelector("#loginPanel");
const signupForm = document.querySelector("#signupPanel");
const loginTab = document.querySelector("#loginTab");
const signupTab = document.querySelector("#signupTab");
const authTitle = document.querySelector("#authTitle");
const authIntro = document.querySelector("#authIntro");
const authMessage = document.querySelector("#authMessage");
const signedInPanel = document.querySelector("#signedInPanel");
const signedInEmail = document.querySelector("#signedInEmail");
const signOutButton = document.querySelector("#signOutButton");
let signupProfilePending = false;

function getPostAuthDestination() {
  const returnTo = new URLSearchParams(window.location.search).get("returnTo");
  return returnTo === "transport-results.html" ? returnTo : "sewa.html";
}

function showMessage(message = "", isError = true) {
  authMessage.textContent = message;
  authMessage.hidden = !message;
  authMessage.classList.toggle("success", !isError);
  authMessage.classList.toggle("error", isError);
}

function setLoading(form, isLoading, label) {
  const submitButton = form.querySelector('button[type="submit"]');
  if (!submitButton) return;
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? "Please wait..." : label;
}

function setMode(mode) {
  const isLogin = mode === "login";
  loginForm.classList.toggle("active", isLogin);
  signupForm.classList.toggle("active", !isLogin);
  loginForm.hidden = !isLogin;
  signupForm.hidden = isLogin;
  loginTab.classList.toggle("active", isLogin);
  signupTab.classList.toggle("active", !isLogin);
  loginTab.setAttribute("aria-selected", String(isLogin));
  signupTab.setAttribute("aria-selected", String(!isLogin));
  authTitle.textContent = isLogin ? "Welcome back" : "Create your account";
  authIntro.textContent = isLogin
    ? "Sign in to your Seva Connect account."
    : "Create a customer account to get started.";
  showMessage();
}

function readableAuthError(error) {
  switch (error?.code) {
    case "auth/user-not-found":
      return "Account not found. Please sign up first.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Account not found or password is incorrect. If you have not signed up, create an account.";
    case "auth/email-already-in-use":
      return "An account already uses this email. Please log in instead.";
    case "auth/weak-password":
      return "Choose a stronger password with at least 8 characters.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a little and try again.";
    case "auth/operation-not-allowed":
    case "auth/configuration-not-found":
      return "Email/password sign-in is not enabled. Enable it in Firebase Authentication settings.";
    case "auth/network-request-failed":
      return "Could not reach Firebase. Check your internet connection and try again.";
    default:
      return "We could not complete that request. Please try again.";
  }
}

function currentUserPanel(user) {
  const isSignedIn = Boolean(user);
  signedInPanel.hidden = !isSignedIn;
  loginForm.hidden = isSignedIn || !loginForm.classList.contains("active");
  signupForm.hidden = isSignedIn || !signupForm.classList.contains("active");
  loginTab.hidden = isSignedIn;
  signupTab.hidden = isSignedIn;
  authMessage.hidden = isSignedIn || !authMessage.textContent;
  if (user) {
    setLoading(loginForm, false, "Log in →");
    setLoading(signupForm, false, "Create account →");
    authTitle.textContent = "Your account";
    authIntro.textContent = "You are signed in to Seva Connect.";
    signedInEmail.textContent = user.email || "";
  } else {
    const isLogin = loginForm.classList.contains("active");
    authTitle.textContent = isLogin ? "Welcome back" : "Create your account";
    authIntro.textContent = isLogin
      ? "Sign in to your Seva Connect account."
      : "Create a customer account to get started.";
  }
}

loginTab.addEventListener("click", () => {
  setMode("login");
});
signupTab.addEventListener("click", () => {
  setMode("signup");
});

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  showMessage();
  if (!loginForm.reportValidity()) return;

  const formData = new FormData(loginForm);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  setLoading(loginForm, true, "Log in →");

  try {
    await window.firebase.auth().signInWithEmailAndPassword(email, password);
    window.location.replace(getPostAuthDestination());
  } catch (error) {
    console.error("Customer sign-in failed:", error);
    showMessage(readableAuthError(error));
    setLoading(loginForm, false, "Log in →");
  }
});

signupForm.addEventListener("submit", async event => {
  event.preventDefault();
  showMessage();
  if (!signupForm.reportValidity()) return;

  const formData = new FormData(signupForm);
  const fullName = String(formData.get("fullName") || "").trim();
  const mobileNumber = String(formData.get("mobileNumber") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  setLoading(signupForm, true, "Create account →");

  let user;
  signupProfilePending = true;
  try {
    const credential = await window.firebase.auth().createUserWithEmailAndPassword(email, password);
    user = credential.user;

    try {
      await window.sevaFirestore.collection("customers").doc(user.uid).set({
        role: "customer",
        fullName,
        mobileNumber,
        emailAddress: email,
        createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (profileError) {
      try {
        await user.delete();
      } catch (rollbackError) {
        console.error("Could not roll back an incomplete customer signup:", rollbackError);
        throw new Error("Your login account was created, but the customer profile could not be saved. Contact support before trying again.");
      }
      throw profileError;
    }

    signupForm.reset();
    signupProfilePending = false;
    window.location.replace(getPostAuthDestination());
  } catch (error) {
    signupProfilePending = false;
    console.error("Customer signup failed:", error);
    showMessage(error.message && !error.code ? error.message : readableAuthError(error));
    setLoading(signupForm, false, "Create account →");
  }
});

signOutButton.addEventListener("click", async () => {
  signOutButton.disabled = true;
  try {
    await window.firebase.auth().signOut();
    setMode("login");
  } catch (error) {
    console.error("Customer sign-out failed:", error);
    showMessage("We could not sign you out. Please try again.");
  } finally {
    signOutButton.disabled = false;
  }
});

if (!window.firebase?.auth || !window.sevaFirestore) {
  showMessage("Firebase could not initialize. Check the Firebase scripts and project configuration.");
} else {
  window.firebase.auth().onAuthStateChanged(user => {
    if (user && signupProfilePending) return;
    if (user) {
      window.location.replace(getPostAuthDestination());
      return;
    }
    currentUserPanel(null);
  });
}
