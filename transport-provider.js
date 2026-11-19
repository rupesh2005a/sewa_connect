const transportProviderForm = document.querySelector("#transportProviderForm");
const transportProviderLoading = document.querySelector("#transportProviderLoading");
const transportProviderMessage = document.querySelector("#transportProviderMessage");
const transportProviderRetry = document.querySelector("#transportProviderRetry");
const transportProviderSubmit = document.querySelector("#transportProviderSubmit");
const providerIdentity = document.querySelector("#providerIdentity");
const serviceAreaInput = transportProviderForm.elements.serviceArea;
const vehicleTypeInput = transportProviderForm.elements.vehicleType;
const vehicleRegistrationInput = transportProviderForm.elements.vehicleRegistrationNumber;
const dateOfBirthInput = transportProviderForm.elements.dateOfBirth;
const drivingLicenceInput = transportProviderForm.elements.drivingLicenceNumber;
const serviceArea = "Gautam Buddha University, Greater Noida";
const vehicleRegistrationPatterns = [
  /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/,
  /^\d{2}BH\d{4}[A-Z]{1,2}$/
];
const drivingLicencePattern = /^[A-Z]{2}\d{2}[A-Z0-9]{6,16}$/;
let currentProvider = null;
let profileLoadPending = false;
let submitPending = false;

function showMessage(text = "", isError = true) {
  transportProviderMessage.textContent = text;
  transportProviderMessage.hidden = !text;
  transportProviderMessage.classList.toggle("error", isError);
  transportProviderMessage.classList.toggle("success", !isError);
}

function normalizeVehicleRegistration(value) {
  return value.trim().toUpperCase().replace(/[\s-]+/g, "");
}

function normalizeDrivingLicence(value) {
  return value.trim().toUpperCase().replace(/[\s/-]+/g, "");
}

function parseDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function getUtcToday() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function isAtLeastEighteen(birthDate, today = getUtcToday()) {
  const yearDifference = today.getUTCFullYear() - birthDate.getUTCFullYear();
  if (yearDifference > 18) return true;
  if (yearDifference < 18) return false;
  if (today.getUTCMonth() !== birthDate.getUTCMonth()) {
    return today.getUTCMonth() > birthDate.getUTCMonth();
  }
  return today.getUTCDate() >= birthDate.getUTCDate();
}

function getLatestEligibleBirthDate() {
  const today = getUtcToday();
  const year = today.getUTCFullYear() - 18;
  const month = today.getUTCMonth();
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(today.getUTCDate(), lastDayOfMonth);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function validateForm() {
  const registration = normalizeVehicleRegistration(vehicleRegistrationInput.value);
  const registrationError = registration && !vehicleRegistrationPatterns.some(pattern => pattern.test(registration))
    ? "Enter a valid Indian vehicle registration number."
    : "";
  setFieldValidation(vehicleRegistrationInput, "#vehicleRegistrationError", registrationError);

  const birthDate = parseDateOnly(dateOfBirthInput.value);
  const today = getUtcToday();
  let dateError = "";
  if (dateOfBirthInput.value && !birthDate) {
    dateError = "Enter a valid date of birth.";
  } else if (birthDate && birthDate > today) {
    dateError = "Date of birth cannot be in the future.";
  } else if (birthDate && !isAtLeastEighteen(birthDate, today)) {
    dateError = "You must be at least 18 years old.";
  }
  setFieldValidation(dateOfBirthInput, "#dateOfBirthError", dateError);

  const licence = normalizeDrivingLicence(drivingLicenceInput.value);
  const licenceError = licence && !drivingLicencePattern.test(licence)
    ? "Enter a valid Indian driving licence number."
    : "";
  setFieldValidation(drivingLicenceInput, "#drivingLicenceError", licenceError);

  transportProviderSubmit.disabled = submitPending || !transportProviderForm.checkValidity();
}

function setFieldValidation(input, errorSelector, errorText) {
  input.setCustomValidity(errorText);
  input.setAttribute("aria-invalid", String(Boolean(errorText)));
  document.querySelector(errorSelector).textContent = errorText;
}

function setTransportDetails(details = {}) {
  serviceAreaInput.value = serviceArea;
  vehicleTypeInput.value = ["Car", "Bike"].includes(details.vehicleType) ? details.vehicleType : "";
  vehicleRegistrationInput.value = details.vehicleRegistrationNumber || "";
  drivingLicenceInput.value = details.drivingLicenceNumber || "";
  const savedBirthDate = details.dateOfBirth?.toDate
    ? details.dateOfBirth.toDate()
    : details.dateOfBirth instanceof Date
      ? details.dateOfBirth
      : null;
  dateOfBirthInput.value = savedBirthDate
    ? savedBirthDate.toISOString().slice(0, 10)
    : "";
  validateForm();
}

function showLoadError(text) {
  transportProviderLoading.hidden = true;
  transportProviderForm.hidden = true;
  transportProviderRetry.hidden = false;
  showMessage(text);
}

async function loadTransportProviderProfile(user) {
  if (profileLoadPending) return;
  profileLoadPending = true;
  currentProvider = user;
  transportProviderLoading.hidden = false;
  transportProviderLoading.textContent = "Loading your transport provider details…";
  transportProviderRetry.hidden = true;
  transportProviderForm.hidden = true;
  showMessage();

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

    providerIdentity.textContent = profile.fullName || user.email || "Provider account";
    setTransportDetails(profile.transportDetails);
    transportProviderLoading.hidden = true;
    transportProviderForm.hidden = false;
    validateForm();
  } catch (error) {
    console.error("Could not load transport provider details:", error);
    showLoadError(error?.code === "permission-denied"
      ? "Firebase rules did not allow loading your profile. Publish the current Firestore rules and try again."
      : "We could not load your profile. Check your connection and try again.");
  } finally {
    profileLoadPending = false;
  }
}

[vehicleTypeInput, vehicleRegistrationInput, dateOfBirthInput, drivingLicenceInput].forEach(input => {
  input.addEventListener("input", () => {
    showMessage();
    validateForm();
  });
  input.addEventListener("change", validateForm);
  input.addEventListener("blur", () => {
    if (input === vehicleRegistrationInput) {
      input.value = normalizeVehicleRegistration(input.value);
    } else if (input === drivingLicenceInput) {
      input.value = normalizeDrivingLicence(input.value);
    }
    validateForm();
  });
});

dateOfBirthInput.max = getLatestEligibleBirthDate();

transportProviderForm.addEventListener("submit", async event => {
  event.preventDefault();
  validateForm();
  if (!currentProvider || !transportProviderForm.reportValidity() || submitPending) return;

  const birthDate = parseDateOnly(dateOfBirthInput.value);
  if (!birthDate || !isAtLeastEighteen(birthDate)) return;

  const registration = normalizeVehicleRegistration(vehicleRegistrationInput.value);
  const licence = normalizeDrivingLicence(drivingLicenceInput.value);
  vehicleRegistrationInput.value = registration;
  drivingLicenceInput.value = licence;
  submitPending = true;
  validateForm();
  transportProviderSubmit.textContent = "Saving your details…";
  showMessage();

  try {
    await window.sevaFirestore.collection("providers").doc(currentProvider.uid).update({
      transportDetails: {
        service: "Transport",
        serviceArea,
        vehicleType: vehicleTypeInput.value,
        vehicleRegistrationNumber: registration,
        dateOfBirth: window.firebase.firestore.Timestamp.fromDate(birthDate),
        drivingLicenceNumber: licence
      }
    });
    showMessage("Your transport provider details were saved. Opening availability…", false);
    window.setTimeout(() => window.location.replace("provider-availability.html"), 700);
  } catch (error) {
    console.error("Could not save transport provider details:", error);
    showMessage(error?.code === "permission-denied"
      ? "Firebase rules did not allow these transport details. Publish the current Firestore rules and try again."
      : "We could not save your transport details. Check your connection and try again.");
    submitPending = false;
    transportProviderSubmit.innerHTML = 'Save and continue <span aria-hidden="true">→</span>';
    validateForm();
  }
});

transportProviderRetry.addEventListener("click", () => {
  if (currentProvider) loadTransportProviderProfile(currentProvider);
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
    loadTransportProviderProfile(user);
  }, error => {
    console.error("Could not verify the provider sign-in:", error);
    showLoadError("We could not verify your sign-in. Please refresh the page.");
  });
}
