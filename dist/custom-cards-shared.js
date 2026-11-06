/* ==========================================================================
   Gedeelde helpers voor de custom cards:
     - custom-network-infrastructure-card
     - synology-nas-card
     - custom-desktop-card
     - docker-combined-card

   Dit bestand moet als resource worden toegevoegd, naast de kaarten zelf.
   De volgorde van laden maakt niet uit: elke kaart wacht tot dit bestand
   klaar is voordat hij zichzelf registreert.

   Vertalingen
     De teksten van de kaarten staan in losse bestanden, een per taal, in de map
     custom-cards-translations (naast dit bestand): nl.json, en.json, ...
     De taal volgt de taal van Home Assistant. Ontbreekt een vertaling, dan wordt
     Engels gebruikt (en.json). Een taal toevoegen = een nieuw <taal>.json plaatsen.

   Inhoud (window.CustomCardsShared):
     - CardBase       basisklasse met de gedeelde methodes
     - CardEditorBase basis voor de visuele editor (ha-form) van een kaart
     - registerCard   registreert een kaart (en eventueel de editor) in Home Assistant
   ========================================================================== */

(() => {
  // Voorkomt problemen als dit bestand dubbel wordt geladen
  if (customElements.get("custom-cards-shared")) return;

  // Bepaal de locatie van deze ES-module zelf. Dit blijft werken wanneer
  // Home Assistant het bestand via een import in ha-custom-cards.js laadt.
  // De stylesheet is per kaart te overschrijven met css_url in de kaartconfiguratie.
  const BASE_URL = new URL(".", import.meta.url).href;

  const CSS_URL = new URL("custom-cards-shared.css", new URL(BASE_URL, location.href)).href;
  const TRANSLATIONS_URL = new URL("custom-cards-translations/", new URL(BASE_URL, location.href)).href;
  const FALLBACK_LANGUAGE = "en";

  // ==========================================================================
  // Vertalingen
  // ==========================================================================

  const fileCache = new Map();
  const stringsCache = new Map();

  const fetchLanguageFile = (language) => {
    if (!fileCache.has(language)) {
      fileCache.set(language, fetch(`${TRANSLATIONS_URL}${language}.json`)
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null));
    }
    return fileCache.get(language);
  };

  // Laadt de teksten voor een taal. Volgorde (de laatste wint): Engels, de basistaal
  // (pt voor pt-BR) en daarna de exacte taal.
  const loadStrings = (language) => {
    if (!stringsCache.has(language)) {
      const languages = [...new Set([FALLBACK_LANGUAGE, language.split("-")[0], language])];

      stringsCache.set(language, Promise.all(languages.map(fetchLanguageFile)).then((files) => {
        const strings = Object.assign({}, ...files.filter(Boolean));

        if (!Object.keys(strings).length) {
          console.error(`custom-cards: no translations found in ${TRANSLATIONS_URL}`);
        }

        return strings;
      }));
    }
    return stringsCache.get(language);
  };

  // Methodes die zowel de kaarten als de editors gebruiken
  const i18n = {
    // Zodra Home Assistant een nieuwe taal doorgeeft, worden de teksten geladen
    _ensureLanguage() {
      const language = this._hass?.locale?.language || this._hass?.language || FALLBACK_LANGUAGE;

      if (language === this._language) return;

      this._language = language;
      updateCatalog(language);

      loadStrings(language).then((strings) => {
        if (this._language !== language) return;

        this._strings = strings;
        this._onStringsLoaded();
      });
    },

    _has(key) {
      return this._strings?.[key] !== undefined;
    },

    // Vertaalde tekst. {naam} in de tekst wordt vervangen door params.naam.
    // Met params.count wordt de meervoudsvorm gekozen: key_one, key_other, ...
    _t(key, params = {}) {
      const strings = this._strings || {};
      let template = strings[key];

      if (params.count !== undefined) {
        let rule = "other";

        try {
          rule = new Intl.PluralRules(this._language || FALLBACK_LANGUAGE).select(Number(params.count));
        } catch (err) {
          // onbekende taalcode: meervoud
        }

        template = strings[`${key}_${rule}`] ?? strings[`${key}_other`] ?? template;
      }

      if (template === undefined) return key;

      return template.replace(/\{(\w+)\}/g, (match, name) => params[name] ?? match);
    }
  };

  // ==========================================================================
  // Kaarten
  // ==========================================================================

  class CardBase extends HTMLElement {
    // ----- Levenscyclus -----

    set hass(hass) {
      this._hass = hass;
      this._ensureLanguage();

      // Pas bijwerken zodra de teksten geladen zijn
      if (this._strings && !this._configError && this._hasRelevantChanges(hass)) this._update();
    }

    // Vergelijk alleen entiteiten waarop de configuratie betrekking heeft.
    _observedEntityIds() {
      const ids = new Set();
      const visit = (value) => {
        if (typeof value === "string" && /^[a-z0-9_]+\.[a-z0-9_]+$/i.test(value)) ids.add(value);
        else if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === "object") Object.values(value).forEach(visit);
      };
      visit(this._config);
      return ids;
    }

    _hasRelevantChanges(hass) {
      const ids = this._observedEntityIds();
      const previous = this._observedStates;
      const current = new Map([...ids].map((id) => [id, hass.states?.[id]]));
      const changed = !previous || current.size !== previous.size ||
        [...current].some(([id, state]) => !previous.has(id) || previous.get(id) !== state) ||
        this._observedConfig !== hass.config || this._observedLocale !== hass.locale ||
        this._observedLanguage !== hass.language ||
        this._observedEntities !== hass.entities || this._observedDevices !== hass.devices;
      this._observedStates = current;
      this._observedConfig = hass.config;
      this._observedLocale = hass.locale;
      this._observedLanguage = hass.language;
      this._observedEntities = hass.entities;
      this._observedDevices = hass.devices;
      return changed;
    }

    // CPU/RAM/temperatuur worden op dezelfde manier weergegeven op desktop en NAS.
    _createSystemSummary(row) {
      return [
        { key: "cpu", label: this._t("label.cpu"), decimals: 1, unit: "%" },
        { key: "memory", label: this._t("label.ram"), decimals: 0, unit: "%" },
        { key: "temperature", label: this._t("label.temp"), decimals: 1, unit: "°C" }
      ].map((def, index) => {
        if (index) {
          const separator = document.createElement("span");
          separator.textContent = "·";
          row.append(separator);
        }
        const el = document.createElement("span");
        this._makeClickable(el, this._config[def.key]);
        row.append(el);
        return { el, ...def };
      });
    }

    _updateSystemSummary() {
      this._summaryItems.forEach(({ el, key, label, decimals, unit }) => {
        el.textContent = `${label} ${this._formatSensor(this._config[key], decimals, unit)}`;
      });
    }

    // Teksten zijn (opnieuw) geladen: de kaart wordt opnieuw opgebouwd
    _onStringsLoaded() {
      if (this._configError) this._showConfigError();
      else this._build();
    }
    _invalidConfig(key, params = {}) {
      this._config = null;
      this._configError = { key, params };
      if (this._strings) this._showConfigError();
    }
    _showConfigError() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      const card = document.createElement("ha-card");
      card.style.padding = "16px";
      card.textContent = this._t(this._configError.key, this._configError.params);
      this.shadowRoot.replaceChildren(card);
    }

    // Eerste stap van _build(): false als er nog geen configuratie is
    _ensureShadow() {
      if (!this._config) return false;
      this._observedStates = null;

      if (!this.shadowRoot) {
        this.attachShadow({ mode: "open" });
      }

      return true;
    }

    // Koppelt de gedeelde stylesheet en plaatst de kaart. De kaart blijft verborgen
    // tot de stylesheet en de vertalingen geladen zijn, zodat er geen kaart zonder
    // opmaak of zonder tekst oplicht.
    _setContent(card) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = this._config.css_url || CSS_URL;

      const reveal = () => {
        if (this._strings) card.style.visibility = "";
      };

      card.style.visibility = "hidden";
      link.addEventListener("load", reveal);
      link.addEventListener("error", () => {
        console.error(`${this.localName}: stylesheet not found: ${link.href}`);
        if (this._strings) card.style.visibility = "";
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
      return value === null ? this._t("status.unknown") : Number(value).toFixed(decimals);
    }

    _formatSensor(entityId, decimals = 1, fallbackUnit = "") {
      const value = this._getNumber(entityId);

      if (value === null) return this._t("status.unknown");

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
    // confirmation: { text: "..." }. confirmText is de (vertaalde) standaardvraag.
    async _runAction(actionConfig, confirmText) {
      if (!actionConfig || !this._hass) return;

      const type = actionConfig.action || "perform-action";
      const isService = type === "perform-action" || type === "call-service";

      const confirmation = actionConfig.confirmation ?? isService;
      if (confirmation) {
        const text = actionConfig.confirmation?.text || confirmText || this._t("action.confirm");
        if (!window.confirm(text)) return;
      }

      switch (type) {
        case "perform-action":
        case "call-service": {
          const service = actionConfig.perform_action || actionConfig.service;
          if (!service || !service.includes(".")) {
            console.warn("Set perform_action as 'domain.action'", actionConfig);
            return;
          }
          const [domain, serviceName] = service.split(".");
          const data = actionConfig.data || actionConfig.service_data || {};
          try {
            await this._hass.callService(domain, serviceName, data, actionConfig.target);
          } catch (err) {
            console.error(`Action ${service} failed:`, err);
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
  // schema aan via registerCard(); labels, uitleg en voorbeeld staan in de
  // vertaalbestanden onder editor.<kaart-id>.<veld>.
  // ==========================================================================

  class CardEditorBase extends HTMLElement {
    setConfig(config) {
      this._config = config;
      this._render();
    }

    set hass(hass) {
      this._hass = hass;
      this._ensureLanguage();

      if (this._form) this._form.hass = hass;
    }

    // Teksten zijn (opnieuw) geladen: het formulier wordt opnieuw opgebouwd
    _onStringsLoaded() {
      this._form = null;
      this.replaceChildren();
      this._render();
    }

    _render() {
      if (!this._strings || !this._config) return;

      if (!this._form) this._create();

      this._form.hass = this._hass;
      this._form.data = this._config;
    }

    // Tekst voor een veld: eerst de tekst van de kaart, dan de gedeelde tekst
    _fieldText(name, suffix = "") {
      const id = this.constructor.CARD_ID;

      for (const key of [`editor.${id}.${name}${suffix}`, `editor.${name}${suffix}`]) {
        if (this._has(key)) return this._t(key);
      }

      return suffix ? "" : name;
    }

    _create() {
      const form = document.createElement("ha-form");
      form.schema = this.constructor.SCHEMA;
      form.computeLabel = (field) => this._fieldText(field.name);
      form.computeHelper = (field) => this._fieldText(field.name, ".help");
      form.addEventListener("value-changed", (event) => this._valueChanged(event));

      // Melding als een lijst geen YAML-lijst is
      const warning = document.createElement("div");
      warning.hidden = true;
      warning.style.cssText =
        "color: var(--error-color, #db4437); font-size: 12px; margin: 4px 0 8px;";
      warning.textContent = this._t("editor.warning_list");

      this.append(form, warning);

      // Voorbeeld van de structuur van de lijsten
      const exampleKey = `editor.${this.constructor.CARD_ID}.example`;

      if (this._has(exampleKey)) {
        const details = document.createElement("details");
        details.style.cssText = "margin-top: 8px;";

        const summary = document.createElement("summary");
        summary.textContent = this._t("editor.example_title");
        summary.style.cssText = "cursor: pointer; color: var(--secondary-text-color); font-size: 13px;";

        const pre = document.createElement("pre");
        pre.textContent = this._t(exampleKey);
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

  Object.assign(CardBase.prototype, i18n);
  Object.assign(CardEditorBase.prototype, i18n);

  // Registreert een kaart bij de browser en in de kaartkiezer van Home Assistant.
  // Met editor ({ schema }) krijgt de kaart ook een visuele editor; id is de naam waaronder
  // de teksten van de editor in de vertaalbestanden staan; stubConfig is de
  // startconfiguratie bij het toevoegen van de kaart.
  const catalog = new Map();
  let catalogLanguage = FALLBACK_LANGUAGE;
  let catalogStrings = {};
  const updateCatalog = (language) => {
    catalogLanguage = language;
    loadStrings(language).then((strings) => {
      if (catalogLanguage !== language) return;
      catalogStrings = strings;
      for (const [id, item] of catalog) {
        item.name = strings[`card.${id}.name`] || item.name;
        item.description = strings[`card.${id}.description`] || item.description;
      }
    });
  };
  const registerCard = (tag, cardClass, { id, name, description, editor, stubConfig }) => {
    if (!customElements.get(tag)) {
      customElements.define(tag, cardClass);
    }

    if (editor) {
      const editorTag = `${tag}-editor`;

      if (!customElements.get(editorTag)) {
        customElements.define(editorTag, class extends CardEditorBase {
          static CARD_ID = id;
          static SCHEMA = editor.schema;
          static LIST_KEYS = editor.schema
            .filter((field) => field.selector?.object)
            .map((field) => field.name);
        });
      }

      cardClass.getConfigElement = () => document.createElement(editorTag);
    }

    if (stubConfig) {
      cardClass.getStubConfig = () => {
        const config = JSON.parse(JSON.stringify(stubConfig));
        if (config.name) config.name = catalogStrings[`card.${id}.default_name`] || config.name;
        if (id === "rows" && config.entries?.[0]) config.entries[0].name = catalogStrings["card.rows.default_name"] || config.entries[0].name;
        return config;
      };
    }

    window.customCards = window.customCards || [];
    const item = { type: tag, name, description };
    window.customCards.push(item);
    catalog.set(id, item);
    const hass = document.querySelector("home-assistant")?.hass;
    updateCatalog(hass?.locale?.language || hass?.language || catalogLanguage);
  };

  window.CustomCardsShared = { CardBase, CardEditorBase, registerCard };

  // Markeert dat de helpers klaar zijn: de kaarten wachten hierop
  customElements.define("custom-cards-shared", class extends HTMLElement {});
})();
