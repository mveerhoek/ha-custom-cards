// Extra element voor custom-rows-card (Bambu Lab-printer, type "bambu_print").
// Vereist custom-rows-card.js; de volgorde van laden maakt niet uit.
(() => {
  // Bambu Lab-printer (ha-bambulab): alle entiteiten zijn optioneel; een waarde of knop zonder
  // entiteit wordt niet getoond, een rij zonder waarden verdwijnt
  const BAMBU_ENTITY_KEYS = [
    "status", "progress", "camera", "pause", "resume", "stop",
    "nozzle_temperature", "nozzle_target", "bed_temperature", "bed_target",
    "speed", "layer", "total_layers", "remaining_time"
  ];

  // Printstatussen (print_status-sensor) waarin de printer bezig, gepauzeerd of aan het voorbereiden is
  const BAMBU_PAUSED = ["pause", "paused"];
  const BAMBU_ACTIVE = ["running", "prepare", ...BAMBU_PAUSED];

  // Zolang de nozzle minstens zo warm is, blijven de waarden-rijen zichtbaar, ook als de printer niet bezig is
  const BAMBU_NOZZLE_WARM = 35;

  // Een duur in de eenheid van de sensor omgerekend naar minuten (standaard minuten)
  const MINUTES_PER_UNIT = { s: 1 / 60, min: 1, h: 60, d: 1440 };

  // Meerdere rijen onder elkaar, elk een gewoon extra-element:
  // - kop: printericoon (oranje tijdens printen) | naam boven status (+ voortgang) | [camera] [pauze/hervat] [stop]
  // - temperaturen: nozzle "huidig / target" en bed "huidig / target"
  // - voortgang: laag "huidig / totaal", resterende tijd en printsnelheid
  // Stoppen vraagt om bevestiging, net als het uitschakelen van een power_switch.
  const buildBambuPrint = (card, extra, helpers) => {
    const { isAvailable, NO_VALUE } = helpers;

    const number = (entityId) => (entityId ? card._getNumber(entityId) : null);

    const format = (value, decimals) => {
      try {
        return value.toLocaleString(card._language, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals
        });
      } catch (err) {
        return value.toFixed(decimals);
      }
    };

    // "huidig / target" van de geconfigureerde entiteiten; ontbrekende waarden als NO_VALUE
    const pairText = (entityIds, decimals) => {
      const ids = entityIds.filter(Boolean);
      const texts = ids.map((entityId) => {
        const value = number(entityId);
        return value === null ? NO_VALUE : format(value, decimals);
      });

      return texts.every((text) => text === NO_VALUE) ? NO_VALUE : texts.join(" / ");
    };

    const temperatureText = (currentId, targetId) => {
      const text = pairText([currentId, targetId], 0);

      return text === NO_VALUE ? text : `${text} ${card._getUnit(currentId || targetId, "°C")}`;
    };

    const durationText = (entityId) => {
      const value = number(entityId);

      if (value === null) return NO_VALUE;

      const unit = card._getState(entityId)?.attributes?.unit_of_measurement;
      const minutes = Math.max(0, Math.round(value * (MINUTES_PER_UNIT[unit] ?? 1)));
      const hours = Math.floor(minutes / 60);
      const rest = `${minutes % 60} ${card._t("rows.bambu_minutes_short")}`;

      return hours ? `${hours} ${card._t("rows.bambu_hours_short")} ${rest}` : rest;
    };

    const press = (entityId) => card._callService("button", "press", { entity_id: entityId });

    // ----- Kop -----

    const header = document.createElement("div");
    header.className = "extra extra-power";

    const view = document.createElement("div");
    view.className = "extra-view";

    const iconWrap = document.createElement("div");
    iconWrap.className = "power-icon";

    const icon = document.createElement("ha-icon");
    icon.icon = extra.icon || "mdi:printer-3d";
    iconWrap.append(icon);

    const labels = document.createElement("div");
    labels.className = "extra-labels";

    const name = document.createElement("div");
    name.className = "entry-name";

    const status = document.createElement("div");
    status.className = "extra-status";
    status.hidden = !extra.status && !extra.progress;

    labels.append(name, status);

    const right = document.createElement("div");
    right.className = "extra-right";

    const camera = extra.camera ? card._iconButton(() => card._openMoreInfo(extra.camera)) : null;
    const pause = extra.pause ? card._iconButton(() => ask(pause, extra.pause, "rows.bambu_confirm_pause")) : null;
    const resume = extra.resume ? card._iconButton(() => ask(resume, extra.resume, "rows.bambu_confirm_resume")) : null;
    const stop = extra.stop ? card._iconButton(() => ask(stop, extra.stop, "rows.bambu_confirm_stop")) : null;

    camera?.setIcon("mdi:video");
    pause?.setIcon("mdi:pause");
    resume?.setIcon("mdi:play");
    stop?.setIcon("mdi:stop");

    right.append(...[camera, pause, resume, stop].filter(Boolean).map((button) => button.el));
    view.append(iconWrap, labels, right);

    // Bevestiging voor pauzeren, hervatten en stoppen: vervangt de kop tijdelijk door een vraag met
    // een kruis en een vink. Eén bevestiging voor alle drie; `pending` onthoudt voor welke knop.
    let confirm = null;
    let confirmView = null;
    let pending = null;

    const ask = (button, entityId, questionKey) => {
      pending = { button, entityId };
      confirm?.show(card._t(questionKey));
    };

    if (pause || resume || stop) {
      confirmView = document.createElement("div");
      confirmView.className = "extra-view";
      confirmView.hidden = true;

      const confirmLabels = document.createElement("div");
      confirmLabels.className = "extra-labels";

      confirm = card._rowConfirm({
        cells: [view],
        wrapper: confirmView,
        textClass: "entry-name",
        onConfirm: () => pending && press(pending.entityId)
      });

      confirm.cells[0].style.fontWeight = "400";
      confirmLabels.append(confirm.cells[0]);
      confirmView.append(confirmLabels, confirm.cells[1], confirm.cells[2]);
    }

    header.append(view);
    if (confirmView) header.append(confirmView);

    // ----- Rijen met waarden -----

    // Rij van icoon + waarden (zelfde opmaak als het sensors-element); zonder waarden geen rij
    const makeRow = (rowIcon, defs) => {
      const configured = defs.filter((def) => def.entity);

      if (!configured.length) return null;

      const el = document.createElement("div");
      el.className = "extra extra-power extra-sensors";

      const rowView = document.createElement("div");
      rowView.className = "extra-view";

      const rowIconWrap = document.createElement("div");
      rowIconWrap.className = "power-icon";

      const rowIconEl = document.createElement("ha-icon");
      rowIconEl.icon = rowIcon;
      rowIconWrap.append(rowIconEl);

      const rowRight = document.createElement("div");
      rowRight.className = "extra-right";

      const items = configured.map((def) => {
        const item = document.createElement("span");
        item.className = "sensor-item";

        const itemIcon = document.createElement("ha-icon");
        itemIcon.icon = def.icon;

        const value = document.createElement("span");

        item.append(itemIcon, value);
        card._makeClickable(item, def.entity);
        rowRight.append(item);

        return { def, item, value };
      });

      rowView.append(rowIconWrap, rowRight);
      el.append(rowView);

      return { el, items, iconWrap: rowIconWrap, icon: rowIconEl };
    };

    const temperatures = makeRow("mdi:thermometer", [
      {
        entity: extra.nozzle_temperature || extra.nozzle_target,
        icon: "mdi:printer-3d-nozzle-heat",
        text: () => temperatureText(extra.nozzle_temperature, extra.nozzle_target)
      },
      {
        entity: extra.bed_temperature || extra.bed_target,
        icon: "mdi:heating-coil",
        text: () => temperatureText(extra.bed_temperature, extra.bed_target)
      }
    ]);

    const progress = makeRow("mdi:progress-clock", [
      {
        entity: extra.layer || extra.total_layers,
        icon: "mdi:layers-outline",
        text: () => pairText([extra.layer, extra.total_layers], 0)
      },
      {
        entity: extra.remaining_time,
        icon: "mdi:timer-sand",
        text: () => durationText(extra.remaining_time)
      },
      {
        entity: extra.speed,
        icon: "mdi:speedometer",
        text: () => card._formatEntity(extra.speed)
      }
    ]);

    // Past drie waarden niet naast elkaar, dan lopen ze door op een tweede regel
    if (progress) {
      const progressRight = progress.el.querySelector(".extra-right");

      progressRight.style.flexWrap = "wrap";
      progressRight.style.justifyContent = "flex-end";
    }

    const rows = [temperatures, progress].filter(Boolean);

    // De iconen van de waarden-rijen springen in: de linkerkant van het icoon zelf komt onder de
    // linkerkant van de tekst in de kop te staan. De afstand wordt gemeten (icoon + tussenruimte
    // van de kop, min de ruimte tussen de rand van het icoonvlak en het icoon) en opnieuw bepaald
    // als de kaart van grootte verandert, bijvoorbeeld bij het uitklappen.
    const indent = () => {
      const iconBox = iconWrap.getBoundingClientRect();
      const textBox = labels.getBoundingClientRect();

      if (!iconBox.width || !textBox.width) return;

      rows.forEach((row) => {
        const wrapBox = row.iconWrap.getBoundingClientRect();
        const glyphBox = row.icon.getBoundingClientRect();

        // Een verborgen rij heeft geen afmetingen; die wordt bij het tonen opnieuw uitgelijnd
        if (!wrapBox.width || !glyphBox.width) return;

        const inset = glyphBox.left - wrapBox.left;
        const offset = `${Math.max(0, Math.round(textBox.left - iconBox.left - inset))}px`;

        if (row.iconWrap.style.marginLeft !== offset) row.iconWrap.style.marginLeft = offset;
      });
    };

    const resizeObserver = typeof ResizeObserver === "function" && rows.length ? new ResizeObserver(indent) : null;

    resizeObserver?.observe(header);

    const update = () => {
      const state = extra.status ? card._getState(extra.status) : null;
      const phase = isAvailable(state) ? state.state : null;
      const paused = BAMBU_PAUSED.includes(phase);
      const running = phase === "running";
      const active = BAMBU_ACTIVE.includes(phase);
      const text = extra.name || card._t("rows.bambu_default_name");

      name.textContent = text;
      name.title = text;

      // Tweede regel: status, bij een lopende print aangevuld met de voortgang
      const parts = [];

      if (extra.status) parts.push(state ? card._stateText(state) : NO_VALUE);

      const percent = number(extra.progress);

      if (percent !== null && (active || !extra.status)) parts.push(`${format(Math.round(percent), 0)}%`);

      const statusText = parts.join(" · ");

      status.textContent = statusText;
      status.title = statusText;

      // Printericoon: oranje tijdens het printen, geel als de print gepauzeerd is, anders grijs
      iconWrap.style.color = running ? "var(--cc-switch-color)" : paused ? "var(--warning-color, #ffa600)" : "";

      // Met een status is er één pauze/hervat-knop (de ene vervangt de andere); zonder status
      // staan beide knoppen er en kan alleen de beschikbaarheid van de knop-entiteit bepalen
      const canSwitch = !!extra.status;
      // Knop-entiteiten staan van zichzelf op "unknown" tot ze voor het eerst zijn ingedrukt;
      // alleen een ontbrekende of "unavailable" entiteit maakt de knop onbruikbaar
      const isUsable = (entityId) => {
        const entityState = card._getState(entityId);

        return !!entityState && entityState.state !== "unavailable";
      };

      if (camera) {
        camera.el.disabled = !isUsable(extra.camera);
        camera.el.setAttribute("aria-label", card._t("rows.bambu_camera"));
      }

      if (pause) {
        pause.el.hidden = !!resume && canSwitch && paused;
        pause.el.disabled = !isUsable(extra.pause) || (canSwitch && !running);
        pause.el.setAttribute("aria-label", card._t("rows.bambu_pause"));
      }

      if (resume) {
        resume.el.hidden = !!pause && canSwitch && !paused;
        resume.el.disabled = !isUsable(extra.resume) || (canSwitch && !paused);
        resume.el.setAttribute("aria-label", card._t("rows.bambu_resume"));
      }

      if (stop) {
        stop.el.disabled = !isUsable(extra.stop) || (canSwitch && !active);
        stop.el.setAttribute("aria-label", card._t("rows.bambu_stop"));
      }

      // Kan de gevraagde actie niet meer (bijvoorbeeld omdat de print klaar is), dan vervalt de vraag
      if (confirm?.isShown() && (!pending || pending.button.el.disabled || pending.button.el.hidden)) confirm.hide();

      // De waarden-rijen zijn alleen relevant als de printer bezig is of de nozzle nog warm is.
      // Zonder status-entiteit is dat niet te bepalen en blijven ze altijd zichtbaar.
      const nozzle = number(extra.nozzle_temperature);
      const hideRows = !!extra.status && !active && !(nozzle !== null && nozzle >= BAMBU_NOZZLE_WARM);

      rows.forEach(({ el }) => {
        el.hidden = hideRows;
        el.style.display = hideRows ? "none" : "";
      });

      rows.forEach(({ items }) => items.forEach(({ def, item, value }) => {
        const valueText = def.text();

        if (value.textContent !== valueText) value.textContent = valueText;

        const title = card._getState(def.entity)?.attributes?.friendly_name;

        if (title) item.title = title;
      }));

      // Na het tonen of verbergen van de rijen, want alleen zichtbare rijen zijn te meten
      indent();
    };

    return {
      el: header,
      els: [header, ...rows.map((row) => row.el)],
      update,
      dispose: () => {
        resizeObserver?.disconnect();
        confirm?.dispose();
      }
    };
  };

  (window.CustomRowsExtras ??= new Map()).set("bambu_print", {
    // bambu_print: losse entiteiten van de ha-bambulab integratie (zie BAMBU_ENTITY_KEYS);
    // minstens één is nodig
    parse(extra, { params }) {
      const entities = {};

      BAMBU_ENTITY_KEYS.forEach((key) => {
        if (typeof extra[key] === "string" && extra[key]) entities[key] = extra[key];
      });

      if (!Object.keys(entities).length) throw { key: "error.rows_extra_bambu", params };

      return {
        ...entities,
        name: extra.name, // optioneel: overschrijft de standaardnaam
        icon: extra.icon // optioneel: overschrijft mdi:printer-3d
      };
    },
    build: buildBambuPrint
  });
  window.dispatchEvent(new Event("custom-rows-extras-changed"));
})();
