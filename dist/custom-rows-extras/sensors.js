// Extra element voor custom-rows-card (sensoren en verbruik, types "sensors" en "consumption").
// Vereist custom-rows-card.js; de volgorde van laden maakt niet uit.
(() => {
  const MAX_SENSORS = 8; // maximaal aantal entiteiten bij een sensors-element

  // Verbruik (consumption): waarden in de volgorde van links naar rechts
  const CONSUMPTION_VALUES = [
    { key: "energy_import", icon: "mdi:transmission-tower-import", decimals: 1, unit: "kWh" },
    { key: "energy_export", icon: "mdi:transmission-tower-export", decimals: 1, unit: "kWh" },
    { key: "gas", icon: "mdi:meter-gas", decimals: 2, unit: "m³" },
    { key: "water", icon: "mdi:water", decimals: 2, unit: "m³" }
  ];

  // Compacte rij: icoon | [label van de rij, vet] | per item [icoon] [label] waarde
  // Het label van de rij is optioneel en staat rechts van het hoofdicoon. Het icoon van een item
  // is standaard mdi:numeric-n-box (n = positie in de lijst), per item te vervangen of te
  // verbergen. Het label van een item is optioneel en normaal van gewicht. De waarde neemt de eenheid van de entiteit
  // over. De eerste entiteit staat links, de laatste rechts (maximaal 8).
  const buildSensors = (card, extra, helpers) => {
    const { isAvailable } = helpers;

    const el = document.createElement("div");
    el.className = "extra extra-power extra-sensors";

    const view = document.createElement("div");
    view.className = "extra-view";

    const iconWrap = document.createElement("div");
    iconWrap.className = "power-icon";

    const icon = document.createElement("ha-icon");
    icon.icon = extra.icon || "mdi:thermometer";
    iconWrap.append(icon);

    let rowLabel = null;

    if (extra.label) {
      rowLabel = document.createElement("div");
      rowLabel.className = "entry-name";
      rowLabel.textContent = extra.label;
      rowLabel.title = extra.label;
    }

    const right = document.createElement("div");
    right.className = "extra-right";

    const items = extra.entities.map(({ entity, icon: iconOverride, iconOff, color, hideIcon, label }, index) => {
      const item = document.createElement("span");
      const isBinary = entity.startsWith("binary_sensor.");
      const defaultIcon = iconOverride || `mdi:numeric-${index + 1}-box`;
      let itemIcon = null;

      item.className = "sensor-item";

      if (!hideIcon) {
        itemIcon = document.createElement("ha-icon");
        itemIcon.icon = defaultIcon;
        // Een gewone sensor heeft altijd de geconfigureerde kleur; een binary sensor pas bij "on"
        if (color && !isBinary) itemIcon.style.color = color;
        item.append(itemIcon);
      }

      if (label) {
        const labelEl = document.createElement("span");
        labelEl.className = "sensor-label";
        labelEl.textContent = label;
        item.append(labelEl);
      }

      const value = document.createElement("span");

      item.append(value);
      card._makeClickable(item, entity);
      right.append(item);

      return { entityId: entity, item, value, itemIcon, isBinary, iconOn: defaultIcon, iconOff: iconOff || defaultIcon, color };
    });

    if (rowLabel) view.append(iconWrap, rowLabel, right);
    else view.append(iconWrap, right);
    el.append(view);

    const update = () => {
      items.forEach(({ entityId, item, value, itemIcon, isBinary, iconOn, iconOff, color }) => {
        const state = card._getState(entityId);

        // Binary sensor: alleen het label tonen, geen status
        const text = isBinary ? "" : card._formatEntity(entityId);

        if (value.textContent !== text) value.textContent = text;
        value.hidden = isBinary;

        if (isBinary && itemIcon) {
          const isOn = state?.state === "on";
          const name = isOn ? iconOn : iconOff;

          if (itemIcon.icon !== name) itemIcon.icon = name;

          // Uit (of onbekend): standaard grijs; de kleur alleen bij aan
          if (isOn && color) itemIcon.style.color = color;
          else itemIcon.style.removeProperty("color");

          itemIcon.style.opacity = isAvailable(state) ? "" : "0.5";
        }

        const title = card._getState(entityId)?.attributes?.friendly_name;

        if (title) item.title = title;
      });
    };

    return { el, update };
  };

  // Compacte rij: teller (zonder label) | [import] [export] [gas] [water]
  // Alleen de geconfigureerde waarden worden getoond, altijd in deze volgorde.
  const buildConsumption = (card, extra) => {
    const el = document.createElement("div");
    el.className = "extra extra-power extra-consumption";

    const view = document.createElement("div");
    view.className = "extra-view";

    const iconWrap = document.createElement("div");
    iconWrap.className = "power-icon";

    const icon = document.createElement("ha-icon");
    icon.icon = extra.icon || "mdi:counter";
    iconWrap.append(icon);

    const right = document.createElement("div");
    right.className = "extra-right";

    const items = CONSUMPTION_VALUES.filter((def) => extra[def.key]).map((def) => {
      const item = document.createElement("span");
      item.className = "consumption-item";

      const itemIcon = document.createElement("ha-icon");
      itemIcon.icon = def.icon;

      const value = document.createElement("span");

      item.append(itemIcon, value);
      card._makeClickable(item, extra[def.key]);
      right.append(item);

      return { def, item, value };
    });

    view.append(iconWrap, right);
    el.append(view);

    const update = () => {
      items.forEach(({ def, item, value }) => {
        const entityId = extra[def.key];
        const text = card._formatValue(entityId, def.decimals, def.unit);

        if (value.textContent !== text) value.textContent = text;

        const title = card._getState(entityId)?.attributes?.friendly_name;

        if (title) item.title = title;
      });
    };

    return { el, update };
  };

  (window.CustomRowsExtras ??= new Map()).set("sensors", {
    // sensors: een lijst met entiteiten (entities) in plaats van één entity. Een item is een
    // entity_id of een object { entity, icon, icon_off, color, hide_icon, label }; meer dan
    // MAX_SENSORS items worden genegeerd. Bij een binary_sensor toont het item alleen het label
    // (niet de status); icon geldt dan voor "on" en icon_off voor "off", en de kleur wordt
    // alleen getoond zolang de sensor aan staat.
    parse(extra, { params }) {
      const entities = (Array.isArray(extra.entities) ? extra.entities : [])
        .map((item) => (typeof item === "string" ? { entity: item } : item))
        .filter((item) => item && typeof item.entity === "string" && item.entity)
        .slice(0, MAX_SENSORS)
        .map((item) => ({
          entity: item.entity,
          icon: typeof item.icon === "string" && item.icon ? item.icon : undefined, // optioneel: vervangt het nummericoon (bij een binary_sensor: icoon voor "on")
          iconOff: typeof item.icon_off === "string" && item.icon_off ? item.icon_off : undefined, // optioneel, alleen binary_sensor: icoon voor "off" (standaard gelijk aan icon)
          color: typeof item.color === "string" && item.color.trim() ? item.color.trim() : undefined, // optioneel: kleur van het icoon (bij een binary_sensor alleen bij "on")
          hideIcon: item.hide_icon === true, // optioneel: toont geen icoon
          label: item.label !== undefined && item.label !== null && item.label !== "" ? String(item.label) : undefined // optioneel: label (normaal)
        }));

      if (!entities.length) throw { key: "error.rows_extra_entity", params };

      return {
        entities,
        icon: extra.icon, // optioneel: overschrijft mdi:thermometer
        label: extra.label !== undefined && extra.label !== null && extra.label !== "" ? String(extra.label) : undefined // optioneel: vet label van de rij
      };
    },
    build: buildSensors
  });
  window.dispatchEvent(new Event("custom-rows-extras-changed"));
  (window.CustomRowsExtras ??= new Map()).set("consumption", {
    // consumption: losse sensoren per soort (energy_import, energy_export, gas, water);
    // minstens één is nodig, niet geconfigureerde waarden worden niet getoond
    parse(extra, { params }) {
      const sensors = {};

      CONSUMPTION_VALUES.forEach(({ key }) => {
        if (typeof extra[key] === "string" && extra[key]) sensors[key] = extra[key];
      });

      if (!Object.keys(sensors).length) throw { key: "error.rows_extra_entity", params };

      return {
        ...sensors,
        icon: extra.icon // optioneel: overschrijft mdi:counter
      };
    },
    build: buildConsumption
  });
  window.dispatchEvent(new Event("custom-rows-extras-changed"));
})();
