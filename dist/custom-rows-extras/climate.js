// Extra element voor custom-rows-card (thermostaat, type "climate").
// Vereist custom-rows-card.js; de volgorde van laden maakt niet uit.
(() => {
  const DEFAULT_STEP = 0.5; // °C per klik bij een climate

  const CLIMATE_ICONS = {
    heat: "mdi:fire",
    cool: "mdi:snowflake",
    heat_cool: "mdi:sun-snowflake-variant",
    auto: "mdi:thermostat-auto",
    dry: "mdi:water-percent",
    fan_only: "mdi:fan",
    off: "mdi:power"
  };

  // Wat doet een climate nu? "heating", "cooling" of null (niet actief).
  // Volgt hvac_action; heeft het toestel dat attribuut niet, dan geldt de ingestelde modus.
  const climateAction = (state, { isAvailable }) => {
    if (!isAvailable(state)) return null;

    const action = state.attributes?.hvac_action ??
      (state.state === "heat" ? "heating" : state.state === "cool" ? "cooling" : null);

    if (action === "heating" || action === "preheating") return "heating";
    if (action === "cooling") return "cooling";

    return null;
  };

  const buildClimate = (card, extra, helpers) => {
    const { isAvailable, toNumber, NO_VALUE } = helpers;

    const el = document.createElement("div");
    el.className = "extra";

    const view = document.createElement("div");
    view.className = "extra-view";

    // Icoon (more-info) | naam boven status | - temperatuur +
    const info = card._iconButton(() => card._openMoreInfo(extra.entity));

    const labels = document.createElement("div");
    labels.className = "extra-labels";

    const name = document.createElement("div");
    name.className = "entry-name";

    const status = document.createElement("div");
    status.className = "extra-status";

    labels.append(name, status);

    const stepper = document.createElement("div");
    stepper.className = "stepper";

    const minus = card._iconButton(() => change(-1));
    minus.setIcon("mdi:minus");

    const value = document.createElement("div");
    value.className = "stepper-value";

    const plus = card._iconButton(() => change(1));
    plus.setIcon("mdi:plus");

    stepper.append(minus.el, value, plus.el);
    view.append(info.el, labels, stepper);
    el.append(view);

    // Lang indrukken op de rij: uit -> aan, anders -> uit
    el.classList.add("long-press");

    const disposeLongPress = card._onLongPress(el, () => {
      const state = card._getState(extra.entity);

      if (!isAvailable(state)) return;

      card._callService("climate", state.state === "off" ? "turn_on" : "turn_off", {
        entity_id: extra.entity
      });
    }, { canStart: () => isAvailable(card._getState(extra.entity)) });

    // Snel achter elkaar klikken: de gekozen waarde wordt direct getoond en na een
    // korte pauze in één keer doorgegeven aan Home Assistant.
    const control = { pending: null, sendTimer: null, clearTimer: null, disposed: false };

    const attributes = () => card._getState(extra.entity)?.attributes || {};

    const change = (direction) => {
      const attrs = attributes();
      const base = control.pending ?? toNumber(attrs.temperature);

      if (base === null) return;

      let next = Math.round((base + direction * extra.step) / extra.step) * extra.step;
      next = Math.round(next * 100) / 100;

      const min = toNumber(attrs.min_temp);
      const max = toNumber(attrs.max_temp);

      if (min !== null) next = Math.max(min, next);
      if (max !== null) next = Math.min(max, next);

      control.pending = next;
      clearTimeout(control.clearTimer);
      clearTimeout(control.sendTimer);
      update();

      control.sendTimer = setTimeout(async () => {
        control.sendTimer = null;
        const target = control.pending;

        await card._callService("climate", "set_temperature", {
          entity_id: extra.entity,
          temperature: target
        });

        if (control.disposed) return;
        // Even wachten tot de nieuwe status binnen is, daarna volgt het label de entiteit weer
        control.clearTimer = setTimeout(() => {
          control.pending = null;
          update();
        }, 1500);
      }, 600);
    };

    const update = () => {
      const state = card._getState(extra.entity);
      const attrs = state?.attributes || {};
      const available = isAvailable(state);

      name.textContent = extra.name || attrs.friendly_name || extra.entity;
      status.textContent = state ? card._stateText(state) : NO_VALUE;

      info.el.setAttribute("aria-label", card._t("rows.more_info", { name: name.textContent }));
      minus.el.setAttribute("aria-label", card._t("rows.decrease_temperature"));
      plus.el.setAttribute("aria-label", card._t("rows.increase_temperature"));
      info.setIcon(extra.icon || CLIMATE_ICONS[state?.state] || "mdi:thermostat");

      // Kleur volgens wat het toestel nu doet (hvac_action, anders de ingestelde modus)
      const action = climateAction(state, helpers);

      info.el.classList.toggle("heating", action === "heating");
      info.el.classList.toggle("cooling", action === "cooling");

      const current = control.pending ?? toNumber(attrs.temperature);
      const unit = card._hass?.config?.unit_system?.temperature || "°C";

      value.textContent = current === null ? NO_VALUE : `${card._formatNumber1(current)} ${unit}`;

      const min = toNumber(attrs.min_temp);
      const max = toNumber(attrs.max_temp);

      minus.el.disabled = !available || current === null || (min !== null && current <= min);
      plus.el.disabled = !available || current === null || (max !== null && current >= max);
    };

    const dispose = () => {
      disposeLongPress();
      control.disposed = true;
      clearTimeout(control.clearTimer);
      if (control.sendTimer) {
        clearTimeout(control.sendTimer);
        control.sendTimer = null;
        card._callService("climate", "set_temperature", { entity_id: extra.entity, temperature: control.pending });
      }
    };
    return { el, update, dispose };
  };

  (window.CustomRowsExtras ??= new Map()).set("climate", {
    parse(extra, { params }) {
      if (!extra.entity) throw { key: "error.rows_extra_entity", params };

      return {
        entity: extra.entity,
        name: extra.name, // optioneel: overschrijft de naam van de entiteit
        icon: extra.icon, // optioneel: overschrijft het icoon van de knop
        step: Number(extra.step) > 0 ? Number(extra.step) : DEFAULT_STEP
      };
    },
    // Statusbadge op het hoofdicoon van de regel: verwarmen of koelen
    statusBadge(card, extra, helpers) {
      const action = climateAction(card._getState(extra.entity), helpers);

      if (action === "heating") return { icon: "mdi:heat-wave", tone: "heat" };
      if (action === "cooling") return { icon: "mdi:snowflake", tone: "cool" };

      return null;
    },
    build: buildClimate
  });
  window.dispatchEvent(new Event("custom-rows-extras-changed"));
})();
