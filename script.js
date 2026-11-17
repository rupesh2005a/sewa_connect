
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
const modalService = $("#modalService");
const modalLocation = $("#modalLocation");
const requestForm = $("#requestForm");
const successMessage = $("#successMessage");
const toast = $("#toast");

let toastTimer;
let currentModalType = "booking";

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

    const modalContent = {

        login: {
            symbol: "✦",
            eyebrow: "WELCOME TO SEVA CONNECT",
            title: "Customer access preview",
            description: "This prototype does not have account login yet. Use the form below to preview a service request."
        },

        provider: {
            symbol: "↗",
            eyebrow: "GROW WITH YOUR COMMUNITY",
            title: "Provider interest preview",
            description: "This prototype can preview your interest in joining as a provider. It does not create a provider account yet."
        },

        booking: {
            symbol: "⌖",
            eyebrow: "LET'S FIND YOUR SERVICE",
            title: "Request a service",
            description: "Tell us what you need. This demo creates a local preview only."
        }
    };

    const content = modalContent[type] || modalContent.booking;

    if (modalSymbol) modalSymbol.textContent = content.symbol;
    if (modalEyebrow) modalEyebrow.textContent = content.eyebrow;
    if (modalTitle) modalTitle.textContent = content.title;
    if (modalDescription) modalDescription.textContent = content.description;

    /* Preselect service category */
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
requestForm?.addEventListener("submit", event => {

    event.preventDefault();

    if (!requestForm.reportValidity()) return;

    const formData = new FormData(requestForm);

    const name = String(formData.get("name") || "").trim();

    const phone = String(formData.get("phone") || "").trim();

    const service = String(formData.get("service") || "").trim();

    const location = String(formData.get("location") || "").trim();

    if (!name || !phone || !service || !location) {

        showToast("Please complete all fields.");

        return;

    }

    /* Front-end demo confirmation only */
    requestForm.hidden = true;

    successMessage.hidden = false;

    const successHeading = $("h3", successMessage);

    const successText = $("p", successMessage);

    if (successHeading) {

        successHeading.textContent =
            currentModalType === "provider"
                ? "Interest preview created!"
                : currentModalType === "login"
                    ? "Demo form completed!"
                    : "Request preview created!";

    }

    if (successText) {

        successText.textContent =
            `Thanks, ${name}. Your ${service} request for ${location} has been previewed. This demo does not send or save your details.`;

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
