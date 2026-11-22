// Extra element voor custom-rows-card (mediaspeler, type "media_player").
// Vereist custom-rows-card.js; de volgorde van laden maakt niet uit.
(() => {
  const MEDIA_ICONS = {
    tv: "mdi:television",
    speaker: "mdi:speaker",
    receiver: "mdi:audio-video"
  };

  const buildMedia = (card, extra, helpers) => {
    const { isAvailable, toNumber, NO_VALUE } = helpers;

    const el = document.createElement("div");
    el.className = "extra";

    const main = document.createElement("div");
    main.className = "extra-view";

    const volumeView = document.createElement("div");
    volumeView.className = "extra-view";
    volumeView.hidden = true;

    const showVolume = (show) => {
      main.hidden = show;
      volumeView.hidden = !show;
    };

    // Hoofdweergave: icoon (more-info) | bron-info | play/pause | volume
    const info = card._iconButton(() => card._openMoreInfo(extra.entity));

    // Twee regels, net als bij de climate: dik bovenaan, normaal eronder
    const labels = document.createElement("div");
    labels.className = "extra-labels";

    const name = document.createElement("div");
    name.className = "entry-name";

    const status = document.createElement("div");
    status.className = "extra-status";

    labels.append(name, status);

    const play = card._iconButton(() =>
      card._callService("media_player", "media_play_pause", { entity_id: extra.entity })
    );

    const volume = card._iconButton(() => showVolume(true));

    main.append(info.el, labels, play.el, volume.el);

    // Volumeweergave: mute | slider | annuleren
    const mute = card._iconButton(() => {
      const muted = card._getState(extra.entity)?.attributes?.is_volume_muted === true;

      card._callService("media_player", "volume_mute", {
        entity_id: extra.entity,
        is_volume_muted: !muted
      });
    });

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "100";
    slider.step = "1";
    slider.className = "volume-slider";

    const cancel = card._iconButton(() => showVolume(false));
    cancel.setIcon("mdi:close");

    volumeView.append(mute.el, slider, cancel.el);
    el.append(main, volumeView);

    // Tijdens het slepen overschrijft een statusupdate de slider niet; het volume
    // wordt hooguit ongeveer 8 keer per seconde doorgegeven.
    const control = { dragging: false, dragTimer: null, sendTimer: null, level: 0 };

    slider.addEventListener("input", () => {
      control.dragging = true;
      clearTimeout(control.dragTimer);
      control.dragTimer = setTimeout(() => { control.dragging = false; }, 1500);

      control.level = Number(slider.value);

      if (!control.sendTimer) {
        control.sendTimer = setTimeout(() => {
          control.sendTimer = null;

          card._callService("media_player", "volume_set", {
            entity_id: extra.entity,
            volume_level: control.level / 100
          });
        }, 120);
      }
    });

    const update = () => {
      const state = card._getState(extra.entity);
      const attrs = state?.attributes || {};
      const active = isAvailable(state) && state.state !== "off";

      info.setIcon(extra.icon || attrs.icon || MEDIA_ICONS[attrs.device_class] || "mdi:speaker");

      // Albumhoes of andere graphic van de speler; zonder graphic blijft het icoon staan
      const picture = isAvailable(state) ? attrs.entity_picture_local || attrs.entity_picture : null;
      info.setPicture(picture ? card._resolveUrl(picture) : null);

      // Bovenste regel (dik): titel van het nummer, anders de naam van de speler.
      // Onderste regel: artiest, anders de bron (bijv. NPO Radio 2), anders de status.
      const title = attrs.media_title;
      const artist = attrs.media_artist;
      const source = attrs.source;
      const stateText = state ? card._stateText(state) : NO_VALUE;

      const top = title || extra.name || attrs.friendly_name || extra.entity;
      const bottom = (title && artist) || source || stateText;

      name.textContent = top;
      name.title = top;
      status.textContent = bottom;
      status.title = bottom;

      info.el.setAttribute("aria-label", card._t("rows.more_info", { name: top }));
      play.el.setAttribute("aria-label", card._t(state?.state === "playing" ? "rows.pause" : "rows.play"));
      volume.el.setAttribute("aria-label", card._t("rows.volume"));
      mute.el.setAttribute("aria-label", card._t(attrs.is_volume_muted ? "rows.unmute" : "rows.mute"));
      slider.setAttribute("aria-label", card._t("rows.volume"));
      cancel.el.setAttribute("aria-label", card._t("rows.close"));
      play.setIcon(state?.state === "playing" ? "mdi:pause" : "mdi:play");
      play.el.disabled = !active;

      const level = toNumber(attrs.volume_level);
      const volumeIcon = attrs.is_volume_muted === true ? "mdi:volume-off" : "mdi:volume-high";
      const noVolume = !active || level === null;

      volume.setIcon(volumeIcon);
      volume.el.disabled = noVolume;
      mute.setIcon(volumeIcon);
      mute.el.disabled = noVolume;
      slider.disabled = noVolume;

      if (!control.dragging && level !== null) {
        slider.value = String(Math.round(level * 100));
      }
    };

    const dispose = () => {
      clearTimeout(control.dragTimer);
      if (control.sendTimer) {
        clearTimeout(control.sendTimer);
        control.sendTimer = null;
        card._callService("media_player", "volume_set", { entity_id: extra.entity, volume_level: control.level / 100 });
      }
    };
    return { el, update, dispose };
  };

  (window.CustomRowsExtras ??= new Map()).set("media_player", {
    parse(extra, { params }) {
      if (!extra.entity) throw { key: "error.rows_extra_entity", params };

      return {
        entity: extra.entity,
        name: extra.name, // optioneel: overschrijft de naam van de entiteit
        icon: extra.icon // optioneel: overschrijft het icoon van de knop
      };
    },
    // Optionele badge (badge: { icon, color }): zichtbaar zolang de speler afspeelt
    badge: { defaultIcon: "mdi:play", isActive: (state) => state?.state === "playing" },
    build: buildMedia
  });
  window.dispatchEvent(new Event("custom-rows-extras-changed"));
})();
