// Extra element voor custom-rows-card (stroomschakelaar, type "power_switch").
// Vereist custom-rows-card.js; de volgorde van laden maakt niet uit.
(() => {
  // Compacte rij: icoon | naam (normaal gewicht) | vermogen | status binary sensor | schakelaar
  const buildPowerSwitch = (card, extra, helpers) => {
    const { NO_VALUE } = helpers;

    const el = document.createElement("div");
    el.className = "extra extra-power";

    const view = document.createElement("div");
    view.className = "extra-view";

    // Icoon: altijd grijs
    const iconWrap = document.createElement("div");
    iconWrap.className = "power-icon";

    const icon = document.createElement("ha-icon");
    icon.icon = extra.icon || "mdi:power-socket-eu";
    iconWrap.append(icon);

    const labels = document.createElement("div");
    labels.className = "extra-labels";

    const name = document.createElement("div");
    name.className = "entry-name";
    // Altijd normaal gewicht: de status wordt al getoond met het statusicoon
    name.style.fontWeight = "400";
    labels.append(name);

    const right = document.createElement("div");
    right.className = "extra-right";

    let power = null;

    if (extra.power) {
      power = document.createElement("span");
      power.className = "extra-value";
      card._makeClickable(power, extra.power);
      right.append(power);
    }

    // Standaardicoon van de binary sensor (afhankelijk van device class en status)
    let statusWrap = null;
    let statusIcon = null;
    const hasStateIcon = !!customElements.get("ha-state-icon");

    if (extra.status) {
      statusWrap = document.createElement("span");
      statusWrap.className = "extra-state-icon";

      statusIcon = document.createElement(hasStateIcon ? "ha-state-icon" : "ha-icon");
      statusWrap.append(statusIcon);

      card._makeClickable(statusWrap, extra.status);
      right.append(statusWrap);
    }

    // Schakelaar aan het eind van de rij: toont altijd de status van de switch,
    // en is alleen klikbaar met switchable: true
    const toggle = document.createElement("span");
    toggle.className = "power-toggle";

    const toggleIcon = document.createElement("ha-icon");
    toggle.append(toggleIcon);

    if (extra.switchable) {
      toggle.classList.add("switchable");
      toggle.setAttribute("role", "switch");
      toggle.setAttribute("tabindex", "0");

      card._onActivate(toggle, () => requestToggle(), { stopPropagation: true });
    }

    right.append(toggle);

    view.append(iconWrap, labels, right);

    // Bevestiging: vervangt de rij tijdelijk door "<naam> uitschakelen?" met een vink en een kruis
    const confirmView = document.createElement("div");
    confirmView.className = "extra-view";
    confirmView.hidden = true;

    const confirmLabels = document.createElement("div");
    confirmLabels.className = "extra-labels";

    // Vraag van de bevestiging (volgt de taal van Home Assistant)
    const confirmQuestion = () =>
      card._t("rows.confirm_off", {
        name: extra.name || card._getState(extra.entity)?.attributes?.friendly_name || extra.entity
      });

    // Bevestiging via de gedeelde helper (_rowConfirm in custom-cards-shared.js):
    // vervangt de rij (view) door de vraag met kruis en vink en keert na 5 seconden vanzelf terug
    const confirm = card._rowConfirm({
      cells: [view],
      wrapper: confirmView,
      textClass: "entry-name",
      onConfirm: () => card._toggle(extra.entity)
    });

    confirm.cells[0].style.fontWeight = "400";
    confirmLabels.append(confirm.cells[0]);
    confirmView.append(confirmLabels, confirm.cells[1], confirm.cells[2]);
    el.append(view, confirmView);

    // Uitschakelen vraagt om bevestiging zolang de binary sensor aan staat;
    // aanzetten, of uitzetten terwijl de binary sensor uit staat, gaat direct.
    const requestToggle = () => {
      const state = card._getState(extra.entity);

      if (!card._hass || !state || state.state === "unavailable") return;

      if (state.state === "on" && extra.status && card._getState(extra.status)?.state === "on") {
        confirm.show(confirmQuestion());
      } else {
        card._toggle(extra.entity);
      }
    };

    const update = () => {
      const state = card._getState(extra.entity);
      const isOn = state?.state === "on";
      const text = extra.name || state?.attributes?.friendly_name || extra.entity;

      name.textContent = text;
      name.title = text;

      if (confirm.isShown()) confirm.setQuestion(confirmQuestion());

      // Is de schakelaar al uit of de binary sensor inmiddels uit, dan vervalt de vraag
      if (confirm.isShown() && (!isOn || !extra.status || card._getState(extra.status)?.state !== "on")) {
        confirm.hide();
      }

      if (power) power.textContent = card._formatValue(extra.power, 0, "W");

      if (statusWrap) {
        const status = card._getState(extra.status);

        if (hasStateIcon) {
          statusIcon.hass = card._hass;
          statusIcon.stateObj = status;
        } else {
          const fallback = status?.attributes?.icon ||
            (status?.state === "on" ? "mdi:checkbox-marked-circle" : "mdi:radiobox-blank");

          if (statusIcon.icon !== fallback) statusIcon.icon = fallback;
        }

        statusWrap.classList.toggle("on", status?.state === "on");
        statusWrap.classList.toggle("unavailable", !status || status.state === "unavailable");
        statusWrap.title = status ? card._stateText(status) : NO_VALUE;
      }

      const toggleName = isOn ? "mdi:toggle-switch-variant" : "mdi:toggle-switch-variant-off";

      if (toggleIcon.icon !== toggleName) toggleIcon.icon = toggleName;

      toggle.classList.toggle("on", isOn);
      toggle.classList.toggle("unavailable", !state || state.state === "unavailable");
      toggle.title = state ? card._stateText(state) : NO_VALUE;

      if (extra.switchable) {
        toggle.setAttribute("aria-checked", String(isOn));
        toggle.setAttribute("aria-label", text);
      }
    };

    return { el, update, dispose: () => confirm.dispose() };
  };

  (window.CustomRowsExtras ??= new Map()).set("power_switch", {
    parse(extra, { params }) {
      if (!extra.entity) throw { key: "error.rows_extra_entity", params };

      return {
        entity: extra.entity,
        name: extra.name, // optioneel: overschrijft de naam van de entiteit
        icon: extra.icon, // optioneel: overschrijft het icoon van de knop
        power: extra.power, // vermogenssensor (optioneel)
        status: extra.status, // binary_sensor (optioneel)
        switchable: extra.switchable === true // schakelbaar vanuit de kaart
      };
    },
    // Optionele badge (badge: { icon, color, use_status }): zichtbaar zolang de schakelaar aan staat
    // of, met badge.use_status en een status-sensor, zolang de status-sensor aan staat
    badge: {
      defaultIcon: "mdi:flash",
      isActive: (state) => state?.state === "on",
      source: (extra) => (extra.badge?.use_status && extra.status ? extra.status : extra.entity)
    },
    build: buildPowerSwitch
  });
  window.dispatchEvent(new Event("custom-rows-extras-changed"));
})();
