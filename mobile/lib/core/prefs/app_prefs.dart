import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../api/dio_client.dart';

/// Ilova mavzusi: light / dark / system.
final appThemeModeProvider =
    StateNotifierProvider<AppThemeModeController, ThemeMode>((ref) {
  return AppThemeModeController(ref.read(secureStorageProvider));
});

class AppThemeModeController extends StateNotifier<ThemeMode> {
  AppThemeModeController(this._storage) : super(ThemeMode.light) {
    _load();
  }

  final FlutterSecureStorage _storage;
  static const _key = 'app_theme_mode';

  Future<void> _load() async {
    final v = await _storage.read(key: _key);
    state = switch (v) {
      'dark' => ThemeMode.dark,
      'system' => ThemeMode.system,
      _ => ThemeMode.light,
    };
  }

  Future<void> setMode(ThemeMode mode) async {
    state = mode;
    final v = switch (mode) {
      ThemeMode.dark => 'dark',
      ThemeMode.system => 'system',
      ThemeMode.light => 'light',
    };
    await _storage.write(key: _key, value: v);
  }
}

/// Supervayzer UI tili (RU / UZ / EN).
enum SvLang { ru, uz, en }

final supervisorLangProvider =
    StateNotifierProvider<SupervisorLangController, SvLang>((ref) {
  return SupervisorLangController(ref.read(secureStorageProvider));
});

class SupervisorLangController extends StateNotifier<SvLang> {
  SupervisorLangController(this._storage) : super(SvLang.ru) {
    _load();
  }

  final FlutterSecureStorage _storage;
  static const _key = 'sv_ui_lang';

  Future<void> _load() async {
    final v = await _storage.read(key: _key);
    state = switch (v) {
      'uz' => SvLang.uz,
      'en' => SvLang.en,
      _ => SvLang.ru,
    };
  }

  Future<void> setLang(SvLang lang) async {
    state = lang;
    await _storage.write(
      key: _key,
      value: switch (lang) {
        SvLang.uz => 'uz',
        SvLang.en => 'en',
        SvLang.ru => 'ru',
      },
    );
  }

  String get label => switch (state) {
        SvLang.ru => 'Русский',
        SvLang.uz => "O'zbekcha",
        SvLang.en => 'English',
      };
}

/// Qisqa tarjimalar — supervisor UI.
class SvL10n {
  final SvLang lang;
  const SvL10n(this.lang);

  String get home => _t('Главная', 'Asosiy', 'Home');
  String get visits => _t('Визиты', 'Vizitlar', 'Visits');
  String get report => _t('Отчёт', 'Hisobot', 'Report');
  String get outlets => _t('Тор. точки', 'Savdo nuqtalari', 'Outlets');
  String get gpsMonitoring => _t('GPS мониторинг', 'GPS monitoring', 'GPS monitoring');
  String get sendLocation =>
      _t('Отправить мою локацию', 'Lokatsiyamni yuborish', 'Send my location');
  String get share => _t('Поделиться', 'Ulashish', 'Share');
  String get darkTheme => _t('Темная тема', 'Qorong\'u tema', 'Dark theme');
  String get language => _t('Язык приложения', 'Ilova tili', 'App language');
  String get logout => _t('Выйти из аккаунта', 'Akkountdan chiqish', 'Log out');
  String get agents => _t('Агенты', 'Agentlar', 'Agents');
  String get notVisited => _t('Не посещал', 'Tashrif buyurmagan', 'Not visited');
  String get visited => _t('Посещено', 'Tashrif buyurilgan', 'Visited');
  String get search => _t('Поиск', 'Qidiruv', 'Search');
  String get filter => _t('Фильтр', 'Filtr', 'Filter');
  String get map => _t('Карта', 'Xarita', 'Map');
  String get soon => _t('Скоро!', 'Tez orada!', 'Soon!');
  String get copied => _t('Скопировано', 'Nusxa olindi', 'Copied');
  String get locationSent =>
      _t('Локация отправлена', 'Lokatsiya yuborildi', 'Location sent');
  String get locationFailed =>
      _t('Не удалось отправить локацию', 'Lokatsiya yuborilmadi', 'Failed to send location');

  String _t(String ru, String uz, String en) => switch (lang) {
        SvLang.ru => ru,
        SvLang.uz => uz,
        SvLang.en => en,
      };
}

final svL10nProvider = Provider<SvL10n>((ref) {
  return SvL10n(ref.watch(supervisorLangProvider));
});
