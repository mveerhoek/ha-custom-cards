// Extra element voor custom-rows-card (zonwering, type "cover").
// Vereist custom-rows-card.js; de volgorde van laden maakt niet uit.
(() => {
  // Hoofdweergave: [open/dicht] | naam boven status + percentage | [omlaag] [omhoog] [slider]
  // Sliderweergave: slider over de volle breedte | [terug]
  const buildCover = (card, extra, helpers) => {
    const { isAvailable, toNumber, NO_VALUE } = helpers;

    const el = document.createElement("div");
    el.className = "extra";

    const main = document.createElement("div");
    main.className = "extra-view";

    const sliderView = document.createElement("div");
    sliderView.className = "extra-view";
    sliderView.hidden = true;

    const showSlider = (show) => {
      main.hidden = show;
      sliderView.hidden = !show;
    };

    const call = (service, data = {}) =>
      card._callService("cover", service, { entity_id: extra.entity, ...data });

    // Links: schakelt tussen open en dicht
    const info = card._iconButton(() => call("toggle"));

    const labels = document.createElement("div");
    labels.className = "extra-labels";

    const name = document.createElement("div");
    name.className = "entry-name";

    const status = document.createElement("div");
    status.className = "extra-status";

    labels.append(name, status);

    // Rechts: sluiten, openen, naar de slider
    const buttons = document.createElement("div");
    buttons.className = "stepper";

    const close = card._iconButton(() => call("close_cover"));
    close.setIcon("mdi:arrow-down");

    const open = card._iconButton(() => call("open_cover"));
    open.setIcon("mdi:arrow-up");

    const swipe = card._iconButton(() => showSlider(true));
    swipe.setIcon("mdi:gesture-swipe-horizontal");

    buttons.append(close.el, open.el, swipe.el);
    main.append(info.el, labels, buttons);

    // Sliderweergave: slider (percentage open) | terug naar de hoofdweergave
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "100";
    slider.step = "1";
    slider.className = "volume-slider";

    const back = card._iconButton(() => showSlider(false));
    back.setIcon("mdi:gesture-tap-button");

    sliderView.append(slider, back.el);
    el.append(main, sliderView);

    // Tijdens het slepen overschrijft een statusupdate de slider niet; de positie wordt
    // hooguit ongeveer 6 keer per seconde doorgegeven en bij loslaten direct. Na loslaten
    // toont de slider de gekozen positie tot de cover er is.
    const control = { dragging: false, dragTimer: null, sendTimer: null, level: 0, target: null, holdUntil: 0 };

    const send = () => {
      clearTimeout(control.sendTimer);
      control.sendTimer = null;
      call("set_cover_position", { position: control.level });
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
      control.holdUntil = Date.now() + 4000;
      send();
    });

    const update = () => {
      const state = card._getState(extra.entity);
      const attrs = state?.attributes || {};
      const available = isAvailable(state);
      const moving = state?.state === "opening" || state?.state === "closing";
      const position = toNumber(attrs.current_position);
      const title = extra.name || attrs.friendly_name || extra.entity;

      name.textContent = title;
      name.title = title;

      // Status (open, dicht, ...) en daarachter hoe ver de cover open is
      let text = state ? card._stateText(state) : NO_VALUE;
      if (available && position !== null) text += ` · ${Math.round(position)}%`;

      status.textContent = text;
      status.title = text;

      info.setIcon(extra.icon || "mdi:window-open");
      info.el.disabled = !available;

      const fullyOpen = position !== null ? position >= 100 : state?.state === "open";

      close.el.disabled = !available || (!moving && state.state === "closed");
      open.el.disabled = !available || (!moving && fullyOpen);
      swipe.el.disabled = !available || position === null;
      slider.disabled = !available || position === null;

      info.el.setAttribute("aria-label", `${card._t("rows.cover_toggle")}: ${title}`);
      close.el.setAttribute("aria-label", card._t("rows.cover_close"));
      open.el.setAttribute("aria-label", card._t("rows.cover_open"));
      swipe.el.setAttribute("aria-label", card._t("rows.cover_slider"));
      slider.setAttribute("aria-label", card._t("rows.position"));
      back.el.setAttribute("aria-label", card._t("rows.back"));

      const holding = control.target !== null && (moving || Date.now() < control.holdUntil);

      if (!holding && !control.dragging) control.target = null;

      if (!control.dragging && position !== null) {
        slider.value = String(Math.round(holding ? control.target : position));
      }
    };

    const dispose = () => {
      clearTimeout(control.dragTimer);
      if (control.sendTimer) send();
    };

    return { el, update, dispose };
  };

  (window.CustomRowsExtras ??= new Map()).set("cover", {
    parse(extra, { params }) {
      if (!extra.entity) throw { key: "error.rows_extra_entity", params };

      return {
        entity: extra.entity,
        name: extra.name, // optioneel: overschrijft de naam van de entiteit
        icon: extra.icon // optioneel: overschrijft het icoon van de knop
      };
    },
    build: buildCover
  });
  window.dispatchEvent(new Event("custom-rows-extras-changed"));
})();
