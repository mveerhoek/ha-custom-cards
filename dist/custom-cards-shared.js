/* ==========================================================================
   Gedeelde helpers voor de custom cards:
     - custom-network-infrastructure-card
     - synology-nas-card
     - custom-desktop-card
     - docker-combined-card

   Dit bestand moet als resource worden toegevoegd, naast de kaarten zelf.
   De volgorde van laden maakt niet uit: elke kaart wacht tot dit bestand
   klaar is voordat hij zichzelf registreert.

   Inhoud (window.CustomCardsShared):
     - CardBase     basisklasse met de gedeelde methodes
     - registerCard registreert een kaart in Home Assistant
   ========================================================================== */

(() => {
  // Voorkomt problemen als dit bestand dubbel wordt geladen
  if (customElements.get("custom-cards-shared")) return;

  // De gedeelde stylesheet staat naast dit bestand. Wordt het script als module
  // geladen, dan is de locatie onbekend en geldt /local/custom-cards-shared.css.
  // Per kaart te overschrijven met css_url in de kaartconfiguratie.
  const CSS_URL = new URL(
    "./custom-cards-shared.css",
    import.meta.url
  ).href;

  class CardBase extends HTMLElement {
    // ----- Levenscyclus -----

    set hass(hass) {
      this._hass = hass;
      this._update();
    }

    // Eerste stap van _build(): false als er nog geen configuratie is
    _ensureShadow() {
      if (!this._config) return false;

      if (!this.shadowRoot) {
        this.attachShadow({ mode: "open" });
      }

      return true;
    }

    // Koppelt de gedeelde stylesheet en plaatst de kaart. De kaart blijft verborgen
    // tot de stylesheet geladen is, zodat er geen kaart zonder opmaak oplicht.
    _setContent(card) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = this._config.css_url || CSS_URL;

      const reveal = () => { card.style.visibility = ""; };

      card.style.visibility = "hidden";
      link.addEventListener("load", reveal);
      link.addEventListener("error", () => {
        console.error(`${this.localName}: stylesheet niet gevonden: ${link.href}`);
        reveal();
      });

      this.shadowRoot.replaceChildren(link, card);
    }

    // ----- Entiteiten uitlezen -----

    _getState(entityId) {
      if (!entityId || !this._hass) return null;
      return this._hass.states[entityId] || null;
    }

    // Status als tekst; null bij onbekend of niet beschikbaar
    _getValue(entityId) {
      const state = this._getState(entityId);

      if (!state || state.state === "unknown" || state.state === "unavailable") {
        return null;
      }

      return state.state;
    }

    // Status als getal; null als het geen getal is
    _getNumber(entityId) {
      const value = this._getValue(entityId);

      if (value === null) return null;

      const number = Number(value);

      return Number.isFinite(number) ? number : null;
    }

    _getUnit(entityId, fallback = "") {
      return this._getState(entityId)?.attributes?.unit_of_measurement || fallback;
    }

    // ----- Opmaak van waarden -----

    _formatNumber(value, decimals = 0) {
      return value === null ? "Onbekend" : Number(value).toFixed(decimals);
    }

    _formatSensor(entityId, decimals = 1, fallbackUnit = "") {
      const value = this._getNumber(entityId);

      if (value === null) return "Onbekend";

      const unit = this._getUnit(entityId, fallbackUnit);

      return `${this._formatNumber(value, decimals)}${unit ? " " + unit : ""}`;
    }

    // Statusindicator: type is success, warning, error of muted (zie de CSS).
    // Zonder label blijft de bestaande tekst staan.
    _setBadge(element, type, label) {
      if (label !== undefined) element.textContent = label;
      element.className = `status-badge status-${type}`;
    }

    // ----- Interactie -----

    // Koppelt een actie aan klikken en aan Enter/spatie
    _onActivate(element, handler, { stopPropagation = false } = {}) {
      element.addEventListener("click", (event) => {
        if (stopPropagation) event.stopPropagation();
        handler(event);
      });

      element.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (stopPropagation) event.stopPropagation();
          handler(event);
        }
      });
    }

    // Maakt een waarde klikbaar: opent het more-info dialoog van de entiteit
    _makeClickable(element, entityId) {
      if (!entityId) return;

      element.classList.add("clickable");
      element.setAttribute("role", "button");
      element.setAttribute("tabindex", "0");

      this._onActivate(
        element,
        () => this._openMoreInfo(entityId),
        { stopPropagation: true }
      );
    }

    // Opent het standaard more-info dialoog (incl. geschiedenis) van de entiteit
    _openMoreInfo(entityId) {
      this.dispatchEvent(new CustomEvent("hass-more-info", {
        bubbles: true,
        composed: true,
        detail: { entityId }
      }));
    }

    // Voert een Home Assistant-actie uit. Ondersteunt: perform-action / call-service,
    // more-info, navigate en url. Service-acties vragen standaard om bevestiging;
    // uit te zetten met confirmation: false, de tekst aan te passen met
    // confirmation: { text: "..." }. Zonder eigen tekst wordt de vraag
    // "Weet je zeker dat je <naam> wilt <werkwoord>?".
    async _runAction(actionConfig, name, verb = "uitvoeren") {
      if (!actionConfig || !this._hass) return;

      const type = actionConfig.action || "perform-action";
      const isService = type === "perform-action" || type === "call-service";

      const confirmation = actionConfig.confirmation ?? isService;
      if (confirmation) {
        const text = actionConfig.confirmation?.text || `Weet je zeker dat je ${name} wilt ${verb}?`;
        if (!window.confirm(text)) return;
      }

      switch (type) {
        case "perform-action":
        case "call-service": {
          const service = actionConfig.perform_action || actionConfig.service;
          if (!service || !service.includes(".")) {
            console.warn("Geef perform_action op als 'domein.actie'", actionConfig);
            return;
          }
          const [domain, serviceName] = service.split(".");
          const data = actionConfig.data || actionConfig.service_data || {};
          try {
            await this._hass.callService(domain, serviceName, data, actionConfig.target);
          } catch (err) {
            console.error(`Actie ${service} mislukt:`, err);
          }
          break;
        }
        case "more-info":
          if (actionConfig.entity) this._openMoreInfo(actionConfig.entity);
          break;
        case "navigate":
          if (actionConfig.navigation_path) {
            history.pushState(null, "", actionConfig.navigation_path);
            window.dispatchEvent(new CustomEvent("location-changed"));
          }
          break;
        case "url":
          if (actionConfig.url_path) window.open(actionConfig.url_path, "_blank");
          break;
      }
    }
  }

  // Registreert een kaart bij de browser en in de kaartkiezer van Home Assistant
  const registerCard = (tag, cardClass, { name, description }) => {
    if (!customElements.get(tag)) {
      customElements.define(tag, cardClass);
    }

    window.customCards = window.customCards || [];
    window.customCards.push({ type: tag, name, description });
  };

  window.CustomCardsShared = { CardBase, registerCard };

  // Markeert dat de helpers klaar zijn: de kaarten wachten hierop
  customElements.define("custom-cards-shared", class extends HTMLElement {});
})();
