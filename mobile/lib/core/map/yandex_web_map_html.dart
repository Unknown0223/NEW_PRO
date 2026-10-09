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

  // MultiRoute sekin — yo‘l chizig‘i uchun siyrak nuqtalar; markerlar to‘liq.
  final forRoad = sampleRoutePointsForRouting(routingPoints);

  final stopsJson = jsonEncode(stops.map((s) => encodeYandexMapStop(s)).toList());
  final routeJson = jsonEncode([
    for (var i = 0; i < forRoad.length; i++)
      encodeYandexMapStop(
        forRoad[i],
        isStart: i == 0,
        isEnd: i == forRoad.length - 1 && forRoad.length > 1,
      ),
  ]);
  final drawLine = drawRoutePolyline && forRoad.length > 1;
  final routeCount = forRoad.length;
  final stopCount = stops.length;
  return YandexMapRuntimeData(
    stopsJson: stopsJson,
    routeJson: routeJson,
    drawLine: drawLine,
    needRouter: drawLine,
    markerBatch: stopCount > 100 ? 40 : (stopCount > 50 ? 48 : stopCount),
    maxRoutePoints: routeCount,
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
  // MultiRoute bo‘laklari: 8 via orasida — kamroq parallel so‘rov, tezroq.
  const routeStep = 8;

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
  <div id="err">Не удалось загрузить карту Yandex. Проверьте интернет.</div>
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
    var userLocationPm = null;
    var ICON_PENDING = null;
    var ICON_VISITED = null;
    var routeBuildToken = 0;

    function userLocationSvg() {
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">' +
        '<circle cx="24" cy="24" r="18" fill="#3b82f6" fill-opacity="0.18"/>' +
        '<circle cx="24" cy="24" r="10" fill="#2563eb" stroke="#ffffff" stroke-width="3"/>' +
        '<circle cx="24" cy="24" r="4" fill="#ffffff"/>' +
        '</svg>';
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    window.setUserLocation = function(lat, lon, pan) {
      if (!map || lat == null || lon == null) return;
      if (userLocationPm) {
        userLocationPm.geometry.setCoordinates([lat, lon]);
      } else {
        userLocationPm = new ymaps.Placemark([lat, lon], {
          hintContent: 'Вы здесь',
          balloonContent: '<b>Вы здесь</b>'
        }, {
          iconLayout: 'default#image',
          iconImageHref: userLocationSvg(),
          iconImageSize: [48, 48],
          iconImageOffset: [-24, -24],
          zIndex: 1000
        });
        map.geoObjects.add(userLocationPm);
      }
      if (pan) {
        map.setCenter([lat, lon], Math.max(map.getZoom(), 15), { duration: 280 });
      }
    };

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
      if (userLocationPm) {
        var c = userLocationPm.geometry.getCoordinates();
        pts.push({ lat: c[0], lon: c[1] });
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

    function cachedIconHref(visited) {
      if (visited) {
        if (!ICON_VISITED) ICON_VISITED = clientMarkerSvg(clientMarkerPalette({ visited: true }));
        return ICON_VISITED;
      }
      if (!ICON_PENDING) ICON_PENDING = clientMarkerSvg(clientMarkerPalette({ visited: false }));
      return ICON_PENDING;
    }

    function clientMarkerOptions(s) {
      return {
        iconLayout: 'default#image',
        iconImageHref: cachedIconHref(!!s.visited),
        iconImageSize: [52, 64],
        iconImageOffset: [-26, -64]
      };
    }

    function clearRouteGraphics() {
      routeBuildToken++;
      routeLines.forEach(function(r) { try { map.geoObjects.remove(r); } catch (e) {} });
      routeLines = [];
      endpointMarkers.forEach(function(m) { try { map.geoObjects.remove(m); } catch (e) {} });
      endpointMarkers = [];
    }

    function hasMultiRouter() {
      return !!(ymaps.multiRouter && ymaps.multiRouter.MultiRoute);
    }

    function addStraightBackbone(pts) {
      var coords = pts.map(function(s) { return [s.lat, s.lon]; });
      var backbone = new ymaps.Polyline(coords, {}, {
        strokeColor: '#94a3b8',
        strokeWidth: 4,
        strokeOpacity: 0.5,
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

    function buildRoadRoute(pts, backbone) {
      if (!map || pts.length < 2 || !hasMultiRouter()) return;
      var STEP = $routeStep;
      var token = routeBuildToken;
      var pending = 0;
      var succeeded = 0;

      function removeBackbone() {
        if (!backbone) return;
        var idx = routeLines.indexOf(backbone);
        if (idx >= 0) {
          try { map.geoObjects.remove(backbone); } catch (e) {}
          routeLines.splice(idx, 1);
        }
        backbone = null;
      }

      function addMultiRouteSlice(slice) {
        if (slice.length < 2 || token !== routeBuildToken) return;
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
            routeStrokeStyle: 'solid',
            routeStrokeWidth: 4,
            opacity: 0.95
          });
          mr.model.events.add('requestsuccess', function() {
            if (token !== routeBuildToken) return;
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

      // Ketma-ket bo‘laklar — parallel MultiRoute ortiqcha yuklamaslik.
      var slices = [];
      if (pts.length <= STEP + 1) {
        slices.push(pts);
      } else {
        for (var start = 0; start < pts.length - 1; start += STEP) {
          var end = Math.min(start + STEP + 1, pts.length);
          slices.push(pts.slice(start, end));
        }
      }

      var si = 0;
      function nextSlice() {
        if (token !== routeBuildToken) return;
        if (si >= slices.length) return;
        addMultiRouteSlice(slices[si++]);
        if (si < slices.length) {
          setTimeout(nextSlice, 90);
        }
      }
      nextSlice();
    }

    function addRouteEndpointMarkers(pts) {
      if (!map || !pts.length) return;
      var start = pts[0];
      var finish = pts[pts.length - 1];
      var startPm = new ymaps.Placemark([start.lat, start.lon], {
        hintContent: start.isStart ? 'Старт' : (start.name || 'Старт'),
        iconCaption: 'A',
        balloonContent: '<b>Старт</b><br/>' + (start.name || '')
      }, { preset: 'islands#darkGreenCircleDotIconWithCaption', zIndex: 700 });
      map.geoObjects.add(startPm);
      endpointMarkers.push(startPm);

      if (pts.length > 1) {
        var endPm = new ymaps.Placemark([finish.lat, finish.lon], {
          hintContent: finish.isEnd ? 'Финиш' : (finish.name || 'Финиш'),
          iconCaption: 'B',
          balloonContent: '<b>Финиш</b><br/>' + (finish.name || '')
        }, { preset: 'islands#redCircleDotIconWithCaption', zIndex: 700 });
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
          props.iconCaption = String(s.order);
          props.balloonContent = '<div style="font-family:system-ui,sans-serif;padding:4px 0">' +
            '<b>' + s.name + '</b><br/><span style="color:#64748b">№ ' + s.order + ' в маршруте</span></div>';
        }
        var opts = clientMarkerOptions(s);
        if (s.order) {
          opts = Object.assign({}, opts, { iconCaptionMaxWidth: 40 });
        }
        var pm = new ymaps.Placemark([s.lat, s.lon], props, opts);
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
        var schedule = window.requestAnimationFrame || function(cb) { setTimeout(cb, 16); };
        schedule(function() { addMarkersBatched(end); });
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
          preset: 'islands#invertedTealClusterIcons',
          groupByCoordinates: false,
          clusterDisableClickZoom: false,
          gridSize: 64
        });
        map.geoObjects.add(clusterer);
        addMarkersBatched(0);
        if (DRAW_LINE) setTimeout(addRouteLine, 40);
        if (window.MapReady) MapReady.postMessage('ok');
      } catch (e) {
        showErr('script_error');
      }
    }

    function bootYmaps() {
      if (typeof ymaps === 'undefined') return false;
      try {
        if (USE_API_KEY && ymaps.meta && ymaps.meta.key && ymaps.meta.key === false) {
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
      var schedule = window.requestAnimationFrame || function(cb) { setTimeout(cb, 0); };
      schedule(function() {
        addMarkersBatched(0);
        if (DRAW_LINE) setTimeout(addRouteLine, 60);
      });
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
      }, 45000);
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
