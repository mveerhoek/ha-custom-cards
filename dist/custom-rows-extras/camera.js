// Extra element voor custom-rows-card (camera, type "camera").
// Vereist custom-rows-card.js; de volgorde van laden maakt niet uit.
(() => {
  // Compacte rij (zelfde opmaak als de kop van de Bambu-printer): icoon | naam | [camera]
  // De knop rechts opent de stream van de camera-entiteit (het more-info-venster), net als de
  // camera-knop bij bambu_print.
  const buildCamera = (card, extra) => {
    const el = document.createElement("div");
    el.className = "extra extra-power";

    const view = document.createElement("div");
    view.className = "extra-view";

    const iconWrap = document.createElement("div");
    iconWrap.className = "power-icon";

    const icon = document.createElement("ha-icon");
    icon.icon = extra.icon || "mdi:camera";
    iconWrap.append(icon);

    const labels = document.createElement("div");
    labels.className = "extra-labels";

    const name = document.createElement("div");
    name.className = "entry-name";
    labels.append(name);

    const right = document.createElement("div");
    right.className = "extra-right";

    const camera = card._iconButton(() => card._openMoreInfo(extra.entity));
    camera.setIcon("mdi:video");
    right.append(camera.el);

    view.append(iconWrap, labels, right);
    el.append(view);

    const update = () => {
      const state = card._getState(extra.entity);
      const text = extra.name || state?.attributes?.friendly_name || extra.entity;

      name.textContent = text;
      name.title = text;

      // Zoals bij bambu_print: alleen een ontbrekende of "unavailable" camera maakt de knop onbruikbaar
      camera.el.disabled = !state || state.state === "unavailable";
      camera.el.setAttribute("aria-label", card._t("rows.camera_open"));
    };

    return { el, update };
  };

  (window.CustomRowsExtras ??= new Map()).set("camera", {
    parse(extra, { params }) {
      if (!extra.entity) throw { key: "error.rows_extra_entity", params };

      return {
        entity: extra.entity,
        name: extra.name, // optioneel: overschrijft de naam van de entiteit
        icon: extra.icon // optioneel: overschrijft mdi:camera
      };
    },
    build: buildCamera
  });
  window.dispatchEvent(new Event("custom-rows-extras-changed"));
})();
