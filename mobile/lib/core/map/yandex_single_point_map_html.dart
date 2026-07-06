import 'dart:convert';

import 'route_map_stop.dart';
import 'yandex_maps_config.dart';

/// Bitta mijoz nuqtasi — `package.full` va marshrutlarsiz, tez yuklanadi.
String buildYandexSinglePointMapHtml({String? apiKey}) {
  final key = apiKey?.trim() ?? resolveYandexMapsJsApiKey()?.trim();
  final useKey = key != null && key.isNotEmpty && key != 'undefined' && key != 'null' && key.length >= 10;
  final scriptUrl = useKey
      ? 'https://api-maps.yandex.ru/2.1/?apikey=${Uri.encodeComponent(key)}&lang=ru_RU'
      : 'https://api-maps.yandex.ru/2.1/?lang=ru_RU';
  final useApiKeyJs = useKey ? 'true' : 'false';

  return '''
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script src="$scriptUrl" type="text/javascript"></script>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #edf3f7; }
    #map { width: 100%; height: 100%; }
    #err { display: none; position: absolute; inset: 0; align-items: center; justify-content: center;
           padding: 24px; text-align: center; font-family: system-ui, sans-serif; color: #64748b; background: #edf3f7; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="err">Yandex xarita yuklanmadi.</div>
  <script>
    var USE_API_KEY = $useApiKeyJs;
    var map = null;
    var marker = null;
    var DEFAULT_LAT = $defaultMapLat;
    var DEFAULT_LON = $defaultMapLon;

    function showErr(reason) {
      document.getElementById('map').style.display = 'none';
      document.getElementById('err').style.display = 'flex';
      if (window.MapReady) MapReady.postMessage('error:' + (reason || 'unknown'));
    }

    function markerSvg() {
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="52" height="64" viewBox="0 0 52 64">' +
        '<ellipse cx="26" cy="61" rx="8" ry="2.5" fill="#13202b" opacity="0.12"/>' +
        '<path fill="#22c55e" stroke="#15803d" stroke-width="1" d="M26 58 L17.5 38.5h17L26 58Z"/>' +
        '<circle cx="26" cy="21" r="17" fill="#22c55e" stroke="#15803d" stroke-width="1.2"/>' +
        '<g transform="translate(26,20.5)">' +
        '<rect x="-8.5" y="3.8" width="17" height="9.8" rx="1.2" fill="#ffffff"/>' +
        '<rect x="-2.4" y="7.4" width="4.8" height="6.2" rx="0.9" fill="#15803d"/>' +
        '</g></svg>';
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    window.setSinglePoint = function(lat, lon, name) {
      if (!map || lat == null || lon == null) return;
      var title = name || 'Mijoz';
      map.setCenter([lat, lon], 15, { duration: 0 });
      if (marker) map.geoObjects.remove(marker);
      marker = new ymaps.Placemark([lat, lon], {
        hintContent: title,
        balloonContent: '<b>' + title + '</b>'
      }, {
        iconLayout: 'default#image',
        iconImageHref: markerSvg(),
        iconImageSize: [52, 64],
        iconImageOffset: [-26, -64]
      });
      map.geoObjects.add(marker);
    };

    function initMap() {
      try {
        map = new ymaps.Map('map', {
          center: [DEFAULT_LAT, DEFAULT_LON],
          zoom: 11,
          controls: ['zoomControl', 'typeSelector']
        }, { suppressMapOpenBlock: true });
        if (window.MapReady) MapReady.postMessage('ok');
      } catch (e) {
        showErr('init_error');
      }
    }

    function bootYmaps() {
      if (typeof ymaps === 'undefined') return false;
      try {
        if (USE_API_KEY && ymaps.env && ymaps.env.apikeyValid === false) {
          showErr('invalid_key');
          return true;
        }
      } catch (e) {}
      ymaps.ready(initMap);
      return true;
    }

    (function startBoot() {
      var attempts = 0;
      function tick() {
        attempts++;
        if (bootYmaps()) return;
        if (attempts < 400) {
          setTimeout(tick, 50);
          return;
        }
        showErr('script_error');
      }
      tick();
      setTimeout(function() {
        if (!map) showErr('timeout');
      }, 45000);
    })();
  </script>
</body>
</html>
''';
}

String singlePointMapJs(double lat, double lon, String name) {
  final safeName = jsonEncode(name);
  return 'window.setSinglePoint && window.setSinglePoint($lat, $lon, $safeName);';
}
