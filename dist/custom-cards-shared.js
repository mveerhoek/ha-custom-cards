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
     - CardBase       basisklasse met de gedeelde methodes
     - CardEditorBase basis voor de visuele editor (ha-form) van een kaart
     - registerCard   registreert een kaart (en eventueel de editor) in Home Assistant
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

  // ==========================================================================
  // Visuele editor
  //
  // Een editor bestaat uit een ha-form met losse velden (entiteiten, tekst, keuzes)
  // en uit "object"-velden voor de lijsten (netwerken, apparaten, volumes, projecten).
  // Een object-veld toont een YAML-vak in de editor. Elke kaart levert zijn eigen
  // schema, labels en voorbeeld aan via registerCard().
  // ==========================================================================

  class CardEditorBase extends HTMLElement {
    setConfig(config) {
      this._config = config;
      this._render();
    }

    set hass(hass) {
      this._hass = hass;
      if (this._form) this._form.hass = hass;
    }

    _render() {
      if (!this._form) this._create();

      this._form.hass = this._hass;
      this._form.data = this._config;
    }

    _create() {
      const { SCHEMA, LABELS, HELPERS, EXAMPLE } = this.constructor;

      const form = document.createElement("ha-form");
      form.schema = SCHEMA;
      form.computeLabel = (field) => LABELS[field.name] ?? field.name;
      form.computeHelper = (field) => HELPERS[field.name] ?? "";
      form.addEventListener("value-changed", (event) => this._valueChanged(event));

      // Melding als een lijst geen YAML-lijst is
      const warning = document.createElement("div");
      warning.hidden = true;
      warning.style.cssText =
        "color: var(--error-color, #db4437); font-size: 12px; margin: 4px 0 8px;";
      warning.textContent =
        "Een lijst moet in YAML beginnen met een streepje (- ). De wijziging is nog niet toegepast.";

      this.append(form, warning);

      // Voorbeeld van de structuur van de lijsten
      if (EXAMPLE) {
        const details = document.createElement("details");
        details.style.cssText = "margin-top: 8px;";

        const summary = document.createElement("summary");
        summary.textContent = "Voorbeeld van de lijsten (YAML)";
        summary.style.cssText = "cursor: pointer; color: var(--secondary-text-color); font-size: 13px;";

        const pre = document.createElement("pre");
        pre.textContent = EXAMPLE;
        pre.style.cssText =
          "margin: 8px 0 0; padding: 8px; overflow: auto; font-size: 12px; " +
          "border-radius: 6px; background: var(--secondary-background-color); " +
          "color: var(--primary-text-color);";

        details.append(summary, pre);
        this.append(details);
      }

      this._form = form;
      this._warning = warning;
    }

    _valueChanged(event) {
      event.stopPropagation();

      const incoming = event.detail?.value;
      if (!incoming) return;

      const listKeys = this.constructor.LIST_KEYS;

      // Lijsten moeten arrays zijn; een leeg object (leeg YAML-vak) telt als leeg
      const isEmptyObject = (v) =>
        v && typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length;

      const invalid = listKeys.filter((key) => {
        const v = incoming[key];
        return v !== undefined && v !== null && v !== "" &&
          !Array.isArray(v) && !isEmptyObject(v);
      });

      this._warning.hidden = invalid.length === 0;
      if (invalid.length) return;

      // Lege waarden weglaten, zodat de YAML-configuratie schoon blijft
      const config = {};

      for (const [key, value] of Object.entries({ ...this._config, ...incoming })) {
        if (value === undefined || value === null || value === "") continue;
        if (isEmptyObject(value)) continue;
        if (Array.isArray(value) && !value.length && listKeys.includes(key)) continue;

        config[key] = value;
      }

      this._config = config;

      this.dispatchEvent(new CustomEvent("config-changed", {
        detail: { config },
        bubbles: true,
        composed: true
      }));
    }
  }

  // Registreert een kaart bij de browser en in de kaartkiezer van Home Assistant.
  // Met editor (schema, labels, helpers, example) krijgt de kaart ook een visuele
  // editor; stubConfig is de startconfiguratie bij het toevoegen van de kaart.
  const registerCard = (tag, cardClass, { name, description, editor, stubConfig }) => {
    if (!customElements.get(tag)) {
      customElements.define(tag, cardClass);
    }

    if (editor) {
      const editorTag = `${tag}-editor`;

      if (!customElements.get(editorTag)) {
        customElements.define(editorTag, class extends CardEditorBase {
          static SCHEMA = editor.schema;
          static LABELS = editor.labels || {};
          static HELPERS = editor.helpers || {};
          static EXAMPLE = editor.example || "";
          static LIST_KEYS = editor.schema
            .filter((field) => field.selector?.object)
            .map((field) => field.name);
        });
      }

      cardClass.getConfigElement = () => document.createElement(editorTag);
    }

    if (stubConfig) {
      cardClass.getStubConfig = () => JSON.parse(JSON.stringify(stubConfig));
    }

    window.customCards = window.customCards || [];
    window.customCards.push({ type: tag, name, description });
  };

  window.CustomCardsShared = { CardBase, CardEditorBase, registerCard };

  // Markeert dat de helpers klaar zijn: de kaarten wachten hierop
  customElements.define("custom-cards-shared", class extends HTMLElement {});
})();
