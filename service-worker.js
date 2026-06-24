const CACHE = "mwd-v0-6-0-f6";
const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./data/countries.json",
  "./data/buildings.json",
  "./data/units_catalog.json",
  "./assets/asset_manifest.json",
  "./assets/img/icon.svg",
  "./assets/img/fallback-world.svg",
  "./manifest.json",
  "./assets/backgrounds/command_center_blue.png",
  "./assets/backgrounds/command_center_red_alert.png",
  "./assets/backgrounds/land_base.png",
  "./assets/backgrounds/naval_port.png",
  "./assets/backgrounds/air_base.png",
  "./assets/backgrounds/global_ops_room.png",
  "./assets/buildings/hq_command_center.png",
  "./assets/buildings/army_base.png",
  "./assets/buildings/naval_port.png",
  "./assets/buildings/air_base.png",
  "./assets/buildings/radar_station.png",
  "./assets/buildings/logistics_hub.png",
  "./assets/buildings/military_factory.png",
  "./assets/buildings/cyber_command.png",
  "./assets/buildings/missile_site.png",
  "./assets/buildings/air_defense_turret.png",
  "./assets/units/naval/patrol_boat.png",
  "./assets/units/naval/frigate.png",
  "./assets/units/naval/destroyer.png",
  "./assets/units/naval/attack_submarine.png",
  "./assets/units/naval/aircraft_carrier.png",
  "./assets/units/air/fighter_stealth.png",
  "./assets/units/air/stealth_bomber.png",
  "./assets/units/air/attack_helicopter.png",
  "./assets/units/air/drone_uav.png",
  "./assets/units/air/transport_aircraft.png",
  "./assets/units/ground/soldier_squad_desert.png",
  "./assets/units/ground/soldier_squad_special_ops.png",
  "./assets/units/ground/main_battle_tank.png",
  "./assets/units/ground/armored_ifv.png",
  "./assets/units/ground/self_propelled_artillery.png",
  "./assets/units/ground/sam_launcher.png",
  "./assets/units/ground/strategic_missile_launcher.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    const clone = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, clone));
    return response;
  }).catch(() => caches.match("./index.html"))));
});
