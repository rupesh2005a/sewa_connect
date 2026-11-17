
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
    if (type === "login") {
        return `
            <label>Full name<input name="name" required autocomplete="name" placeholder="Enter your full name" /></label>
            <label>Mobile number<input name="phone" required inputmode="tel" pattern="[0-9+ ()-]{8,16}" autocomplete="tel" placeholder="Enter mobile number" /></label>
            <label>Email address<input name="email" type="email" required autocomplete="email" placeholder="Enter your email address" /></label>
        `;
    }

    if (type === "provider") {
        return `
            <label>Full name<input name="name" required autocomplete="name" placeholder="Enter your full name" /></label>
            <label>Mobile number<input name="phone" required inputmode="tel" pattern="[0-9+ ()-]{8,16}" autocomplete="tel" placeholder="Enter mobile number" /></label>
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

        login: {
            symbol: "✦",
            eyebrow: "WELCOME TO SEVA CONNECT",
            title: "Customer registration",
            description: "Register your details to get started. This form does not create or verify an account."
        },

        provider: {
            symbol: "↗",
            eyebrow: "GROW WITH YOUR COMMUNITY",
            title: "Join as a service provider",
            description: "Share your details to join Seva Connect. This form does not create or verify an account."
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

        if (currentModalType === "login") {
            const email = String(formData.get("email") || "").trim();
            if (!name || !phone || !email) throw new Error("Please complete all required fields.");
            collectionName = "customers";
            documentData = { role: "customer", fullName: name, mobileNumber: phone, emailAddress: email, createdAt: serverTimestamp };
        } else if (currentModalType === "provider") {
            const vehicleNumber = String(formData.get("vehicleNumber") || "").trim().toUpperCase();
            const vehicleType = String(formData.get("vehicleType") || "").trim();
            if (!name || !phone || !vehicleNumber || !["Car", "Bike"].includes(vehicleType)) {
                throw new Error("Please complete all required fields.");
            }
            collectionName = "providers";
            documentData = { role: "provider", fullName: name, mobileNumber: phone, vehicleNumber, vehicleType, createdAt: serverTimestamp };
            savedHeading = "Provider details saved!";
            savedText = `Thanks, ${name}. Your provider registration was saved to Seva Connect.`;
        } else {
            const service = String(formData.get("service") || "").trim();
            const location = String(formData.get("location") || "").trim();
            if (!name || !phone || !service || !location) throw new Error("Please complete all fields.");
            collectionName = "bookingRequests";
            documentData = { customerName: name, phoneNumber: phone, service, location, status: "pending", createdAt: serverTimestamp };
            savedHeading = "Booking request sent!";
            savedText = `Thanks, ${name}. Your ${service} request for ${location} was saved.`;
        }

        await window.sevaFirestore.collection(collectionName).add(documentData);

        requestForm.hidden = true;
        successMessage.hidden = false;

        const successHeading = $("h3", successMessage);
        const successText = $("p", successMessage);
        if (successHeading) successHeading.textContent = savedHeading;
        if (successText) successText.textContent = savedText;
    } catch (error) {
        console.error("Firebase write failed:", error);
        setSubmitLoading(false);
        setFormError(error?.code === "permission-denied"
            ? "Firebase rejected the submission. Please check the Firestore rules."
            : "We could not save your details. Please check your connection and try again.");
    }
});

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
