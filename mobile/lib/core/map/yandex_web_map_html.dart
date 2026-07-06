import 'dart:convert';

import 'route_map_stop.dart';

Map<String, dynamic> encodeYandexMapStop(RouteMapStop s, {bool isStart = false, bool isEnd = false}) => {
      'id': s.clientId,
      'name': s.name,
      'lat': s.latitude,
      'lon': s.longitude,
      'order': s.orderIndex,
      'visited': s.visited,
      if (isStart) 'isStart': true,
      if (isEnd) 'isEnd': true,
    };

/// Xarita HTML va JS yangilash uchun umumiy ma'lumot.
class YandexMapRuntimeData {
  final String stopsJson;
  final String routeJson;
  final bool drawLine;
  final bool needRouter;
  final int markerBatch;
  final int maxRoutePoints;

  const YandexMapRuntimeData({
    required this.stopsJson,
    required this.routeJson,
    required this.drawLine,
    required this.needRouter,
    required this.markerBatch,
    required this.maxRoutePoints,
  });
}

YandexMapRuntimeData computeYandexMapRuntimeData({
  required List<RouteMapStop> stops,
  List<RouteMapStop>? routeLine,
  RouteMapStop? routeStart,
  bool drawRoutePolyline = true,
}) {
  final visits = routeLine ?? [];
  final routingPoints = <RouteMapStop>[];
  if (routeStart != null && routeStart.hasCoords) {
    routingPoints.add(routeStart);
  }
  routingPoints.addAll(visits);

  final stopsJson = jsonEncode(stops.map((s) => encodeYandexMapStop(s)).toList());
  final routeJson = jsonEncode([
    for (var i = 0; i < routingPoints.length; i++)
      encodeYandexMapStop(
        routingPoints[i],
        isStart: i == 0,
        isEnd: i == routingPoints.length - 1 && routingPoints.length > 1,
      ),
  ]);
  final drawLine = drawRoutePolyline && routingPoints.length > 1;
  final routeCount = routingPoints.length;
  return YandexMapRuntimeData(
    stopsJson: stopsJson,
    routeJson: routeJson,
    drawLine: drawLine,
    needRouter: drawLine,
    markerBatch: stops.length > 200 ? 60 : stops.length,
    maxRoutePoints: routeCount > 120 ? 120 : routeCount,
  );
}

/// WebView tayyor bo‘lganda to‘liq qayta yuklamasdan markerlarni yangilash.
String yandexMapUpdateJs(YandexMapRuntimeData data) =>
    'window.applyMapData&&window.applyMapData(${data.stopsJson},${data.routeJson},${data.drawLine ? 'true' : 'false'});';

/// Web panel bilan bir xil: kalit bo'lmasa `api-maps.yandex.ru/2.1/?lang=ru_RU`.
String buildYandexWebMapHtml({
  required List<RouteMapStop> stops,
  List<RouteMapStop>? routeLine,
  RouteMapStop? routeStart,
  String? apiKey,
  bool drawRoutePolyline = true,
}) {
  final key = apiKey?.trim();
  final useKey = key != null && key.isNotEmpty && key != 'undefined' && key != 'null' && key.length >= 10;
  final scriptUrl = useKey
      ? 'https://api-maps.yandex.ru/2.1/?apikey=${Uri.encodeComponent(key)}&lang=ru_RU'
      : 'https://api-maps.yandex.ru/2.1/?lang=ru_RU';

  final runtime = computeYandexMapRuntimeData(
    stops: stops,
    routeLine: routeLine,
    routeStart: routeStart,
    drawRoutePolyline: drawRoutePolyline,
  );
  final stopsJson = runtime.stopsJson;
  final routeJson = runtime.routeJson;
  final drawLine = runtime.drawLine;
  final maxRoutePoints = runtime.maxRoutePoints;
  final markerBatch = runtime.markerBatch;
  final needRouter = runtime.needRouter;
  final useApiKeyJs = useKey ? 'true' : 'false';
  const routeStep = 9;

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
  <div id="err">Yandex xarita yuklanmadi. Internetni tekshiring.</div>
  <script>
    var STOPS = $stopsJson;
    var ROUTE = $routeJson;
    var USE_API_KEY = $useApiKeyJs;
    var DRAW_LINE = ${drawLine ? 'true' : 'false'};
    var NEED_ROUTER = ${needRouter ? 'true' : 'false'};
    var MAX_ROUTE_POINTS = $maxRoutePoints;
    var MARKER_BATCH = $markerBatch;
    var map = null;
    var clusterer = null;
    var routeLines = [];
    var endpointMarkers = [];

    function showErr(reason) {
      document.getElementById('map').style.display = 'none';
      document.getElementById('err').style.display = 'flex';
      if (window.MapReady) MapReady.postMessage('error:' + (reason || 'unknown'));
    }

    function allCoords() {
      var pts = STOPS.slice();
      if (ROUTE.length) {
        ROUTE.forEach(function(r) {
          if (!pts.some(function(p) { return p.lat === r.lat && p.lon === r.lon; })) pts.push(r);
        });
      }
      return pts;
    }

    function fitBounds() {
      var pts = allCoords();
      if (!map || !pts.length) return;
      if (pts.length === 1) {
        map.setCenter([pts[0].lat, pts[0].lon], 15);
        return;
      }
      var lats = pts.map(function(s) { return s.lat; });
      var lons = pts.map(function(s) { return s.lon; });
      map.setBounds([
        [Math.min.apply(null, lats), Math.min.apply(null, lons)],
        [Math.max.apply(null, lats), Math.max.apply(null, lons)]
      ], { checkZoomRange: true, zoomMargin: [56, 56, 140, 56] });
    }

    /** Shablon: dumaloq teal marker + oq do'kon (Указать на карте). */
    function clientMarkerPalette(s) {
      if (s.visited) {
        return { fill: '#22c55e', dark: '#15803d', door: '#15803d' };
      }
      return { fill: '#07958f', dark: '#056b66', door: '#056b66' };
    }

    function clientMarkerSvg(palette) {
      var f = palette.fill;
      var d = palette.dark;
      var door = palette.door;
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="52" height="64" viewBox="0 0 52 64">' +
        '<defs>' +
        '<filter id="s" x="-20%" y="-10%" width="140%" height="130%">' +
        '<feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#13202b" flood-opacity="0.22"/>' +
        '</filter>' +
        '<linearGradient id="g" x1="26" y1="6" x2="26" y2="40" gradientUnits="userSpaceOnUse">' +
        '<stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/>' +
        '<stop offset="1" stop-color="#000000" stop-opacity="0.12"/>' +
        '</linearGradient>' +
        '</defs>' +
        '<ellipse cx="26" cy="61" rx="8" ry="2.5" fill="#13202b" opacity="0.12"/>' +
        '<g filter="url(#s)">' +
        '<path fill="' + f + '" stroke="' + d + '" stroke-width="1" stroke-linejoin="round" d="M26 58 L17.5 38.5h17L26 58Z"/>' +
        '<circle cx="26" cy="21" r="17" fill="' + f + '" stroke="' + d + '" stroke-width="1.2"/>' +
        '<circle cx="26" cy="21" r="17" fill="url(#g)"/>' +
        '<g transform="translate(26,20.5)">' +
        '<path fill="#ffffff" d="M-9.5,0.5 Q-7.5,-2.5 -5.5,0.5 T-1.5,0.5 T2.5,0.5 T6.5,0.5 T9.5,0.5 L9.5,3.8 L-9.5,3.8 Z"/>' +
        '<rect x="-8.5" y="3.8" width="17" height="9.8" rx="1.2" fill="#ffffff"/>' +
        '<rect x="-2.4" y="7.4" width="4.8" height="6.2" rx="0.9" fill="' + door + '"/>' +
        '</g></g></svg>';
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    function clientMarkerOptions(s) {
      return {
        iconLayout: 'default#image',
        iconImageHref: clientMarkerSvg(clientMarkerPalette(s)),
        iconImageSize: [52, 64],
        iconImageOffset: [-26, -64]
      };
    }

    function clearRouteGraphics() {
      routeLines.forEach(function(r) { map.geoObjects.remove(r); });
      routeLines = [];
      endpointMarkers.forEach(function(m) { map.geoObjects.remove(m); });
      endpointMarkers = [];
    }

    function hasMultiRouter() {
      return !!(ymaps.multiRouter && ymaps.multiRouter.MultiRoute);
    }

    function addStraightBackbone(pts) {
      var coords = pts.map(function(s) { return [s.lat, s.lon]; });
      var backbone = new ymaps.Polyline(coords, {}, {
        strokeColor: '#94a3b8',
        strokeWidth: 3,
        strokeOpacity: 0.55,
        strokeStyle: 'dash'
      });
      map.geoObjects.add(backbone);
      routeLines.push(backbone);
      return backbone;
    }

    function addRouteLine() {
      if (!map || !DRAW_LINE || ROUTE.length < 2) return;
      clearRouteGraphics();

      var pts = ROUTE.slice();
      if (MAX_ROUTE_POINTS > 0 && pts.length > MAX_ROUTE_POINTS) {
        pts = pts.slice(0, MAX_ROUTE_POINTS);
      }

      addRouteEndpointMarkers(pts);

      if (!hasMultiRouter()) {
        addStraightBackbone(pts);
        return;
      }

      var backbone = addStraightBackbone(pts);
      buildRoadRoute(pts, backbone);
    }

    /** Ketma-ket nuqtalar bo'yicha yo'l tarmog'idan marshrut (MultiRouter). */
    function buildRoadRoute(pts, backbone) {
      if (!map || pts.length < 2 || !hasMultiRouter()) return;
      var STEP = $routeStep;
      var pending = 0;
      var succeeded = 0;

      function removeBackbone() {
        if (!backbone) return;
        var idx = routeLines.indexOf(backbone);
        if (idx >= 0) {
          map.geoObjects.remove(backbone);
          routeLines.splice(idx, 1);
        }
        backbone = null;
      }

      function addMultiRouteSlice(slice) {
        if (slice.length < 2) return;
        var refPoints = slice.map(function(s) { return [s.lat, s.lon]; });
        pending++;
        try {
          var mr = new ymaps.multiRouter.MultiRoute({
            referencePoints: refPoints,
            params: { routingMode: 'auto', results: 1 }
          }, {
            boundsAutoApply: false,
            wayPointVisible: false,
            viaPointVisible: false,
            pinVisible: false,
            routeActiveStrokeColor: '#07958f',
            routeActiveStrokeWidth: 6,
            routeActiveStrokeStyle: 'solid',
            opacity: 0.95
          });
          mr.model.events.add('requestsuccess', function() {
            succeeded++;
            pending--;
            if (succeeded > 0) removeBackbone();
          });
          mr.model.events.add('requestfail', function() {
            pending--;
          });
          map.geoObjects.add(mr);
          routeLines.push(mr);
        } catch (e) {
          pending--;
        }
      }

      if (pts.length <= STEP + 1) {
        addMultiRouteSlice(pts);
      } else {
        for (var start = 0; start < pts.length - 1; start += STEP) {
          var end = Math.min(start + STEP + 1, pts.length);
          addMultiRouteSlice(pts.slice(start, end));
        }
      }
    }

    function addRouteEndpointMarkers(pts) {
      if (!map || !pts.length) return;
      var start = pts[0];
      var finish = pts[pts.length - 1];
      var startPm = new ymaps.Placemark([start.lat, start.lon], {
        hintContent: start.isStart ? 'Boshlanish' : (start.name || 'Boshlanish'),
        iconCaption: 'A',
        balloonContent: '<b>Boshlanish</b><br/>' + (start.name || '')
      }, { preset: 'islands#darkGreenCircleDotIconWithCaption' });
      map.geoObjects.add(startPm);
      endpointMarkers.push(startPm);

      if (pts.length > 1) {
        var endPm = new ymaps.Placemark([finish.lat, finish.lon], {
          hintContent: finish.isEnd ? 'Yakun' : (finish.name || 'Yakun'),
          iconCaption: 'B',
          balloonContent: '<b>Yakun</b><br/>' + (finish.name || '')
        }, { preset: 'islands#redCircleDotIconWithCaption' });
        map.geoObjects.add(endPm);
        endpointMarkers.push(endPm);
      }
    }

    function buildMarkersSlice(from, to) {
      return STOPS.slice(from, to).map(function(s) {
        var props = {
          hintContent: s.name,
          balloonContent: '<div style="font-family:system-ui,sans-serif;padding:4px 0"><b>' + s.name + '</b></div>'
        };
        if (s.order) {
          props.balloonContent = '<div style="font-family:system-ui,sans-serif;padding:4px 0">' +
            '<b>' + s.name + '</b><br/><span style="color:#64748b">№ ' + s.order + ' marshrutda</span></div>';
        }
        var pm = new ymaps.Placemark([s.lat, s.lon], props, clientMarkerOptions(s));
        pm.events.add('click', function() {
          if (window.StopTap) {
            StopTap.postMessage(JSON.stringify({ clientId: s.id, name: s.name }));
          }
        });
        return pm;
      });
    }

    function addMarkersBatched(start) {
      if (!clusterer) return;
      var end = Math.min(start + MARKER_BATCH, STOPS.length);
      if (end <= start) {
        fitBounds();
        return;
      }
      clusterer.add(buildMarkersSlice(start, end));
      if (end < STOPS.length) {
        setTimeout(function() { addMarkersBatched(end); }, 0);
      } else {
        fitBounds();
      }
    }

    function initMap() {
      try {
        map = new ymaps.Map('map', {
          center: [$defaultMapLat, $defaultMapLon],
          zoom: 12,
          controls: ['typeSelector']
        }, { suppressMapOpenBlock: true });

        clusterer = new ymaps.Clusterer({
          preset: 'islands#tealClusterIcons',
          groupByCoordinates: false,
          clusterDisableClickZoom: false
        });
        map.geoObjects.add(clusterer);
        if (window.MapReady) MapReady.postMessage('ok');
        setTimeout(function() {
          addMarkersBatched(0);
          setTimeout(addRouteLine, 200);
        }, 50);
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
      } catch (e) { /* eski versiya */ }
      if (NEED_ROUTER) {
        ymaps.ready(['package.full', 'multiRouter.MultiRoute'], initMap);
      } else {
        ymaps.ready(initMap);
      }
      return true;
    }

    window.applyMapData = function(stops, route, drawLine) {
      STOPS = stops || [];
      ROUTE = route || [];
      DRAW_LINE = !!drawLine;
      if (!map || !clusterer) return;
      clusterer.removeAll();
      clearRouteGraphics();
      setTimeout(function() {
        addMarkersBatched(0);
        if (DRAW_LINE) setTimeout(addRouteLine, 120);
      }, 0);
    };

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
      }, 60000);
    })();

    window.zoomIn = function() {
      if (map) map.setZoom(map.getZoom() + 1, { duration: 200 });
    };
    window.zoomOut = function() {
      if (map) map.setZoom(map.getZoom() - 1, { duration: 200 });
    };
    window.panTo = function(lat, lon, zoom) {
      if (map) map.setCenter([lat, lon], zoom || 15, { duration: 300 });
    };
    window.refit = fitBounds;
    window.focusStop = function(lat, lon) {
      if (map) map.setCenter([lat, lon], 16, { duration: 300 });
    };
  </script>
</body>
</html>
''';
}
