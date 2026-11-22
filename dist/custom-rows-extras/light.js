// Extra element voor custom-rows-card (lichtbron, type "light").
// Vereist custom-rows-card.js; de volgorde van laden maakt niet uit.
(() => {
  // Hoofdweergave: icoon (kleur van de lamp) | naam | [helderheid] [kleur] [schakelaar]
  // Sliderweergave: helderheidsslider over de volle breedte | [terug]
  const buildLight = (card, extra, helpers) => {
    const { NO_VALUE } = helpers;

    const COLOR_MODES = ["hs", "xy", "rgb", "rgbw", "rgbww", "color_temp"];

    const el = document.createElement("div");
    el.className = "extra extra-power extra-light";

    const view = document.createElement("div");
    view.className = "extra-view";

    const sliderView = document.createElement("div");
    sliderView.className = "extra-view";
    sliderView.hidden = true;

    const showSlider = (show) => {
      view.hidden = show;
      sliderView.hidden = !show;
    };

    // Icoon: grijs als de lamp uit is, anders de kleur van de lamp (of oranje)
    const iconWrap = document.createElement("div");
    iconWrap.className = "power-icon light-icon";

    const iconName = extra.icon || "mdi:lightbulb";
    const icon = document.createElement("ha-icon");
    icon.icon = iconName;
    iconWrap.append(icon);

    const labels = document.createElement("div");
    labels.className = "extra-labels";

    const name = document.createElement("div");
    name.className = "entry-name";

    // Tweede regel (niet vet): helderheid in procenten, alleen bij dimbare lampen
    const intensity = document.createElement("div");
    intensity.className = "extra-status";
    intensity.hidden = true;

    labels.append(name, intensity);

    const right = document.createElement("div");
    right.className = "extra-right";

    // Helderheid: toont de slider in plaats van de rij (alleen bij dimbare lampen)
    const dim = card._iconButton(() => showSlider(true));
    dim.setIcon("mdi:gesture-swipe-horizontal");
    dim.el.hidden = true;

    // Kleur: vierkant vlak in de huidige kleur van de lamp; opent het standaard
    // Home Assistant-venster van de lamp (alleen bij lampen met kleurkeuze)
    const color = card._iconButton(() => card._openMoreInfo(extra.entity));
    color.el.classList.add("color-btn");
    color.el.hidden = true;

    const swatch = document.createElement("span");
    swatch.className = "color-swatch";
    color.el.append(swatch);

    // Schakelaar: groen als aan, grijs als uit
    const toggle = document.createElement("span");
    toggle.className = "power-toggle switchable";
    toggle.setAttribute("role", "switch");
    toggle.setAttribute("tabindex", "0");

    const toggleIcon = document.createElement("ha-icon");
    toggle.append(toggleIcon);

    card._onActivate(toggle, () => card._toggle(extra.entity), { stopPropagation: true });

    right.append(dim.el, color.el, toggle);
    view.append(iconWrap, labels, right);

    // Sliderweergave: helderheid in procenten | terug naar de hoofdweergave
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "100";
    slider.step = "1";
    slider.className = "volume-slider";

    const back = card._iconButton(() => showSlider(false));
    back.setIcon("mdi:gesture-tap-button");

    sliderView.append(slider, back.el);
    el.append(view, sliderView);

    // Zelfde aanpak als bij de zonwering: tijdens het slepen overschrijft een update de
    // slider niet, de waarde wordt gedoseerd doorgegeven en bij loslaten direct; daarna
    // blijft de gekozen waarde even staan tot de lamp bijgewerkt is. 0% schakelt uit.
    const control = { dragging: false, dragTimer: null, sendTimer: null, level: 0, target: null, holdUntil: 0 };

    const send = () => {
      clearTimeout(control.sendTimer);
      control.sendTimer = null;

      if (control.level <= 0) {
        card._callService("light", "turn_off", { entity_id: extra.entity });
      } else {
        card._callService("light", "turn_on", { entity_id: extra.entity, brightness_pct: control.level });
      }
    };

    slider.addEventListener("input", () => {
      control.dragging = true;
      clearTimeout(control.dragTimer);
      control.dragTimer = setTimeout(() => { control.dragging = false; }, 1500);

      control.level = Number(slider.value);
      control.target = control.level;

      if (!control.sendTimer) control.sendTimer = setTimeout(send, 150);
    });

    slider.addEventListener("change", () => {
      clearTimeout(control.dragTimer);
      control.dragging = false;
      control.level = Number(slider.value);
      control.target = control.level;
      control.holdUntil = Date.now() + 2000;
      send();
    });

    const update = () => {
      const state = card._getState(extra.entity);
      const attrs = state?.attributes || {};
      const available = !!state && state.state !== "unavailable";
      const isOn = state?.state === "on";
      const text = extra.name || attrs.friendly_name || extra.entity;

      name.textContent = text;
      name.title = text;

      if (icon.icon !== iconName) icon.icon = iconName;

      // Uit: grijs (CSS). Aan: kleur van de lamp (rgb_color); heeft de entiteit die niet
      // (bijv. een switch), dan oranje.
      const rgb = attrs.rgb_color;
      const hasRgb = isOn && Array.isArray(rgb) && rgb.length === 3 &&
        rgb.every((part) => Number.isFinite(Number(part)));
      const lampColor = hasRgb
        ? `rgb(${rgb.map((part) => Math.round(Number(part))).join(", ")})`
        : isOn ? "var(--cc-switch-color)" : "";

      iconWrap.style.color = lampColor;

      // Welke bediening de lamp ondersteunt
      const modes = Array.isArray(attrs.supported_color_modes) ? attrs.supported_color_modes : [];
      const canColor = modes.some((mode) => COLOR_MODES.includes(mode));
      const canDim = modes.some((mode) => mode !== "onoff" && mode !== "unknown");

      color.el.hidden = !canColor;
      dim.el.hidden = !canDim;

      if (!canDim && !sliderView.hidden) showSlider(false);

      swatch.style.background = lampColor || "var(--disabled-text-color, #bdbdbd)";

      color.el.disabled = !available;
      dim.el.disabled = !available;
      slider.disabled = !available;

      color.el.setAttribute("aria-label", card._t("rows.color"));
      dim.el.setAttribute("aria-label", card._t("rows.brightness"));
      slider.setAttribute("aria-label", card._t("rows.brightness"));
      back.el.setAttribute("aria-label", card._t("rows.back"));

      // Helderheid in procenten (uit = 0)
      const brightness = Number(attrs.brightness);
      const level = isOn && Number.isFinite(brightness) ? Math.round((brightness / 255) * 100) : 0;
      const holding = control.target !== null && Date.now() < control.holdUntil;

      if (!holding && !control.dragging) control.target = null;

      if (!control.dragging) slider.value = String(holding ? control.target : level);

      intensity.hidden = !canDim;

      const intensityText = available ? `${level}%` : NO_VALUE;

      intensity.textContent = intensityText;
      intensity.title = intensityText;

      const toggleName = isOn ? "mdi:toggle-switch-variant" : "mdi:toggle-switch-variant-off";

      if (toggleIcon.icon !== toggleName) toggleIcon.icon = toggleName;

      toggle.classList.toggle("on", isOn);
      toggle.classList.toggle("unavailable", !available);
      toggle.title = state ? card._stateText(state) : NO_VALUE;
      toggle.setAttribute("aria-checked", String(isOn));
      toggle.setAttribute("aria-label", text);
    };

    const dispose = () => {
      clearTimeout(control.dragTimer);
      if (control.sendTimer) send();
    };

    return { el, update, dispose };
  };

  (window.CustomRowsExtras ??= new Map()).set("light", {
    parse(extra, { params }) {
      if (!extra.entity) throw { key: "error.rows_extra_entity", params };

      return {
        entity: extra.entity,
        name: extra.name, // optioneel: overschrijft de naam van de entiteit
        icon: extra.icon // optioneel: overschrijft het icoon van de knop
      };
    },
    build: buildLight
  });
  window.dispatchEvent(new Event("custom-rows-extras-changed"));
})();
