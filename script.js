
/* =========================================================
   SEVA CONNECT - FRONT-END JAVASCRIPT
   Compatible with the supplied sewa.html and style.css
   ========================================================= */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const modalBackdrop = $("#modalBackdrop");
const modalTitle = $("#modalTitle");
const modalDescription = $("#modalDescription");
const modalEyebrow = $("#modalEyebrow");
const modalSymbol = $("#modalSymbol");
const requestForm = $("#requestForm");
const successMessage = $("#successMessage");
const toast = $("#toast");

let toastTimer;
let currentModalType = "booking";

function registrationForm(type) {
    if (type === "provider") {
        return `
            <label>Full name<input name="name" required autocomplete="name" placeholder="Enter your full name" /></label>
            <label>Mobile number<input name="phone" required inputmode="tel" pattern="[0-9+ ()-]{8,16}" autocomplete="tel" placeholder="Enter mobile number" /></label>
            <label>Email address<input name="email" type="email" required maxlength="254" autocomplete="email" placeholder="you@example.com" /></label>
            <label>Password <small>At least 8 characters</small><input name="password" type="password" required minlength="8" autocomplete="new-password" placeholder="Create a password" /></label>
            <label>Vehicle number<input name="vehicleNumber" required pattern="[A-Za-z0-9 -]{4,20}" placeholder="Enter vehicle number" /></label>
            <label>Vehicle type<select name="vehicleType" required><option value="">Choose vehicle type</option><option>Car</option><option>Bike</option></select></label>
        `;
    }

    return `
        <label>Your name<input name="name" required autocomplete="name" placeholder="Enter your name" /></label>
        <label>Phone number<input name="phone" required inputmode="tel" pattern="[0-9+ ()-]{8,16}" autocomplete="tel" placeholder="Enter phone number" /></label>
        <label>Service needed<select name="service" id="modalService" required><option value="">Choose a service</option><option>Transport</option><option>Agriculture &amp; equipment</option><option>Repair &amp; maintenance</option><option>Home services</option><option>Construction</option><option>Other local services</option></select></label>
        <label>Village / area<input name="location" id="modalLocation" required placeholder="Enter your village or area" /></label>
    `;
}

function setFormError(message = "") {
    const formError = $("#formError");
    if (!formError) return;
    formError.textContent = message;
    formError.hidden = !message;
}

function setSubmitLoading(isLoading) {
    const submitButton = $("#modalSubmit");
    if (!submitButton) return;
    submitButton.disabled = isLoading;
    submitButton.innerHTML = isLoading ? "Saving <span aria-hidden=\"true\">...</span>" : "Continue <span>→</span>";
}

/* Set current year in footer */
const yearElement = $("#year");

if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
}

/* Show notification */
function showToast(message) {
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2800);
}

/* Open modal */
function openModal(type = "booking", category = "") {

    if (!modalBackdrop || !requestForm || !successMessage) return;
    if (type === "provider" && window.firebase?.auth?.()?.currentUser) {
        showToast("Sign out before creating a separate provider account.");
        return;
    }

    currentModalType = type;

    requestForm.reset();
    requestForm.hidden = false;
    successMessage.hidden = true;
    setFormError();
    setSubmitLoading(false);
    requestForm.innerHTML = `${registrationForm(type)}
        <button class="btn btn-primary modal-submit" type="submit" id="modalSubmit">Continue <span>→</span></button>
        <small class="form-note">${type === "booking" ? "Your booking request will be saved securely." : "Registration details will be saved to Seva Connect."}</small>
        <p class="form-error" id="formError" role="alert" hidden></p>`;

    const modalContent = {

        provider: {
            symbol: "↗",
            eyebrow: "GROW WITH YOUR COMMUNITY",
            title: "Join as a service provider",
            description: "Create a provider account and add your service details."
        },

        booking: {
            symbol: "⌖",
            eyebrow: "LET'S FIND YOUR SERVICE",
            title: "Request a service",
            description: "Tell us what you need and send a booking request."
        }
    };

    const content = modalContent[type] || modalContent.booking;

    if (modalSymbol) modalSymbol.textContent = content.symbol;
    if (modalEyebrow) modalEyebrow.textContent = content.eyebrow;
    if (modalTitle) modalTitle.textContent = content.title;
    if (modalDescription) modalDescription.textContent = content.description;

    /* Preselect service category */
    const modalService = $("#modalService");
    if (modalService) {

        modalService.value = "";

        if (category) {

            const normalizedCategory = category.toLowerCase().trim();

            const matchingOption = [...modalService.options].find(option => {
                return option.textContent.toLowerCase().includes(normalizedCategory);
            });

            if (matchingOption) {
                modalService.value = matchingOption.value;
            }
        }
    }

    /* Copy hero location into modal */
    const heroLocation = $("#heroLocation");
    const modalLocation = $("#modalLocation");

    if (modalLocation && heroLocation && heroLocation.value.trim()) {
        modalLocation.value = heroLocation.value.trim();
    }

    modalBackdrop.hidden = false;
    document.body.style.overflow = "hidden";

    setTimeout(() => {
        const nameInput = $('input[name="name"]', requestForm);

        if (nameInput) nameInput.focus();

    }, 60);
}

/* Close modal */
function closeModal() {

    if (!modalBackdrop) return;

    modalBackdrop.hidden = true;
    document.body.style.overflow = "";
}

/* Open modal buttons */
$$("[data-open]").forEach(button => {

    button.addEventListener("click", () => {

        openModal(button.dataset.open || "booking");

    });

});

/* Modal close buttons */
$("#modalClose")?.addEventListener("click", closeModal);

$("#successClose")?.addEventListener("click", closeModal);

/* Close modal when clicking outside */
modalBackdrop?.addEventListener("click", event => {

    if (event.target === modalBackdrop) {
        closeModal();
    }

});

/* Close modal using Escape key */
document.addEventListener("keydown", event => {

    if (
        event.key === "Escape" &&
        modalBackdrop &&
        !modalBackdrop.hidden
    ) {
        closeModal();
    }

});

/* Filter services */
function filterServices(category = "all", search = "") {

    const query = search.trim().toLowerCase();

    const cards = $$(".service-card");

    let visibleCount = 0;

    cards.forEach(card => {

        const cardCategory = card.dataset.category || "";

        const searchableText = [
            card.dataset.search || "",
            card.innerText || ""
        ].join(" ").toLowerCase();

        const categoryMatches =
            category === "all" || cardCategory === category;

        const searchMatches =
            !query || searchableText.includes(query);

        const shouldShow = categoryMatches && searchMatches;

        card.hidden = !shouldShow;

        if (shouldShow) {
            visibleCount++;
        }

    });

    /* Show empty state */
    const emptyState = $("#emptyState");

    if (emptyState) {
        emptyState.hidden = visibleCount !== 0;
    }

    /* Update active category */
    $$(".category-tab").forEach(tab => {

        const isActive = tab.dataset.category === category;

        tab.classList.toggle("active", isActive);

        tab.setAttribute("aria-pressed", String(isActive));

    });

}

/* Category buttons */
$$(".category-tab").forEach(tab => {

    tab.addEventListener("click", () => {

        const searchInput = $("#heroSearch");

        filterServices(
            tab.dataset.category || "all",
            searchInput?.value || ""
        );

    });

});

/* Search button */
$("#searchBtn")?.addEventListener("click", () => {

    const searchInput = $("#heroSearch");
    const locationInput = $("#heroLocation");

    const searchTerm = searchInput?.value || "";

    const location = locationInput?.value.trim() || "";

    filterServices("all", searchTerm);

    $("#services")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    if (location) {

        showToast(
            `Showing matching services for ${location}. Provider locations are not connected in this demo.`
        );

    }

});

/* Search using Enter key */
$("#heroSearch")?.addEventListener("keydown", event => {

    if (event.key === "Enter") {

        event.preventDefault();

        $("#searchBtn")?.click();

    }

});

/* Start search button */
$("#startSearch")?.addEventListener("click", () => {

    $("#services")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

});

/* Explore button */
$("#ctaExplore")?.addEventListener("click", () => {

    $("#services")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

});

/* Service card booking buttons */
$$("[data-pick]").forEach(button => {

    button.addEventListener("click", () => {

        openModal("booking", button.dataset.pick || "");

    });
});

$$("[data-transport]").forEach(button => {
    button.addEventListener("click", event => {
        event.stopPropagation();
        window.location.href = "transport.html";
    });
});

const transportCard = $(".transport-card");

if (transportCard) {
    transportCard.addEventListener("click", event => {
        if (!event.target.closest("[data-transport]")) {
            window.location.href = "transport.html";
        }
    });

    transportCard.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            window.location.href = "transport.html";
        }
    });
}

/* Footer category links */
$$("[data-footer-category]").forEach(link => {

    link.addEventListener("click", () => {

        const category = link.dataset.footerCategory || "all";

        filterServices(category, "");

    });

});

/* Submit request form */
requestForm?.addEventListener("submit", async event => {

    event.preventDefault();

    if (!requestForm.reportValidity()) return;

    const formData = new FormData(requestForm);
    const name = String(formData.get("name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    setFormError();
    setSubmitLoading(true);

    try {
        if (!window.sevaFirestore || !window.firebase) {
            throw new Error("Firebase is unavailable. Check the Firebase scripts and internet connection.");
        }

        let savedHeading = "Registration saved!";
        let savedText = `Thanks, ${name}. Your details were saved to Seva Connect.`;
        let documentData;
        let collectionName;
        const serverTimestamp = window.firebase.firestore.FieldValue.serverTimestamp();

        if (currentModalType === "provider") {
            const vehicleNumber = String(formData.get("vehicleNumber") || "").trim().toUpperCase();
            const vehicleType = String(formData.get("vehicleType") || "").trim();
            const email = String(formData.get("email") || "").trim();
            const password = String(formData.get("password") || "");
            if (!name || !phone || !email || password.length < 8 || !vehicleNumber || !["Car", "Bike"].includes(vehicleType)) {
                throw new Error("Please complete all required fields.");
            }
            let providerUser;
            try {
                const credential = await window.firebase.auth().createUserWithEmailAndPassword(email, password);
                providerUser = credential.user;
                collectionName = "providers";
                documentData = {
                    role: "provider",
                    fullName: name,
                    mobileNumber: phone,
                    emailAddress: email,
                    vehicleNumber,
                    vehicleType,
                    createdAt: serverTimestamp
                };
                await window.sevaFirestore.collection(collectionName).doc(providerUser.uid).set(documentData);
            } catch (providerError) {
                if (providerUser) {
                    try {
                        await providerUser.delete();
                    } catch (rollbackError) {
                        console.error("Could not roll back an incomplete provider signup:", rollbackError);
                        throw new Error("Your login account was created, but the provider profile could not be saved. Contact support before trying again.");
                    }
                }
                throw providerError;
            }
            savedHeading = "Provider account created!";
            savedText = `Thanks, ${name}. Your provider profile is saved. You can log in with ${email}.`;
        } else {
            const service = String(formData.get("service") || "").trim();
            const location = String(formData.get("location") || "").trim();
            if (!name || !phone || !service || !location) throw new Error("Please complete all fields.");
            collectionName = "bookingRequests";
            documentData = { customerName: name, phoneNumber: phone, service, location, status: "pending", createdAt: serverTimestamp };
            savedHeading = "Booking request sent!";
            savedText = `Thanks, ${name}. Your ${service} request for ${location} was saved.`;
        }

        if (currentModalType !== "provider") {
            await window.sevaFirestore.collection(collectionName).add(documentData);
        }

        requestForm.hidden = true;
        successMessage.hidden = false;

        const successHeading = $("h3", successMessage);
        const successText = $("p", successMessage);
        if (successHeading) successHeading.textContent = savedHeading;
        if (successText) successText.textContent = savedText;
    } catch (error) {
        console.error("Firebase write failed:", error);
        setSubmitLoading(false);
        const providerAuthErrors = {
            "auth/email-already-in-use": "An account already uses this email. Log in instead.",
            "auth/invalid-email": "Enter a valid email address.",
            "auth/weak-password": "Choose a stronger password with at least 8 characters.",
            "auth/operation-not-allowed": "Email/password sign-in is not enabled in Firebase Authentication."
        };
        setFormError(providerAuthErrors[error?.code] || (error?.code === "permission-denied"
            ? "Firebase rejected the submission. Please check the Firestore rules."
            : error?.message && !error?.code
                ? error.message
                : "We could not save your details. Please check your connection and try again."));
    }
});

const navActions = $("#navActions");

function renderNavigationUser(user) {
    if (!navActions) return;
    if (!user) {
        navActions.innerHTML = '<a class="btn btn-ghost" href="auth.html">Log in</a><button class="btn btn-primary" data-open="provider"><span class="provider-join-full">Join as provider</span><span class="provider-join-short">Provider</span> <span>↗</span></button>';
        navActions.querySelector('[data-open="provider"]')?.addEventListener("click", () => openModal("provider"));
        return;
    }

    const identity = user.displayName || user.email || "Account";
    navActions.innerHTML = `
        <span class="nav-user-label" title="${escapeHtml(identity)}">Signed in as <strong>${escapeHtml(identity)}</strong></span>
        <a class="btn btn-ghost" href="profile.html">My profile</a>
        <button class="btn btn-primary" type="button" data-sign-out>Sign out</button>
    `;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

navActions?.addEventListener("click", async event => {
    const signOutButton = event.target.closest("[data-sign-out]");
    if (!signOutButton) return;
    signOutButton.disabled = true;
    try {
        await window.firebase.auth().signOut();
        showToast("You have been signed out.");
    } catch (error) {
        console.error("Sign-out failed:", error);
        signOutButton.disabled = false;
        showToast("We could not sign you out. Please try again.");
    }
});

if (window.firebase?.auth) {
    window.firebase.auth().onAuthStateChanged(renderNavigationUser, error => {
        console.error("Could not read the authentication state:", error);
    });
}

/* Mobile menu */
const menuToggle = $("#menuToggle");

const mainNav = $("#mainNav");

menuToggle?.addEventListener("click", () => {

    if (!mainNav) return;

    const isOpen = mainNav.classList.toggle("open");

    menuToggle.setAttribute("aria-expanded", String(isOpen));

    menuToggle.textContent = isOpen ? "×" : "☰";

});

/* Close mobile menu after clicking navigation links */
$$(".nav a").forEach(link => {

    link.addEventListener("click", () => {

        if (!mainNav || !menuToggle) return;

        mainNav.classList.remove("open");

        menuToggle.setAttribute("aria-expanded", "false");

        menuToggle.textContent = "☰";

    });

});
