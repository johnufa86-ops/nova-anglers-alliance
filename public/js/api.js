/* ============================================================
   NOVA ANGLERS ALLIANCE — API ACCESS LAYER (base)
   ============================================================
   Единственная точка, где фронтенд говорит с сервером.
   Каждая страница обязана работать с данными через слои
   (applications.js / competitions.js / admin.js), а не через
   fetch напрямую.

   Ошибки нормализуются в объект:
     { code, message, details }
   где code — один из:
     OFFLINE               нет сети
     VALIDATION_ERROR      400 — details: { field: text }
     UNAUTHORIZED          401 — нужна авторизация
     FORBIDDEN             403 — нет прав / вход / регистрация закрыта
     NOT_FOUND             404
     DUPLICATE_APPLICATION 409 — повторная заявка
     RATE_LIMITED          429
     SERVER                прочие 4xx/5xx
   ============================================================ */

window.NOVA_API = (function () {

  function errorMessage(code, fallback) {
    const M = {
      OFFLINE: 'Не удалось связаться с сервером. Проверьте подключение к интернету и повторите попытку.',
      VALIDATION_ERROR: 'Проверьте правильность заполнения формы.',
      UNAUTHORIZED: 'Требуется вход в кабинет организатора.',
      FORBIDDEN: 'Недостаточно прав для этого действия.',
      NOT_FOUND: 'Не найдено.',
      DUPLICATE_APPLICATION: 'У вас уже есть заявка на это соревнование.',
      RATE_LIMITED: 'Слишком много попыток. Попробуйте позже.',
      SERVER: 'Временная ошибка. Попробуйте позже.',
    };
    return M[code] || fallback || M.SERVER;
  }

  async function request(method, url, body) {
    let res;
    let headers;
    let payload = body;
    if (body && !(body instanceof FormData)) {
      // обычные JSON-запросы; FormData уходит как есть —
      // браузер сам ставит multipart-заголовок с boundary
      headers = { 'Content-Type': 'application/json' };
      payload = JSON.stringify(body);
    }
    try {
      res = await fetch(url, {
        method,
        headers,
        body: payload,
        credentials: 'same-origin',
      });
    } catch (e) {
      // network failure / offline / DNS — fetch throws
      throw { code: 'OFFLINE', message: errorMessage('OFFLINE'), details: null, raw: e };
    }

    let data = null;
    try { data = await res.json(); } catch (e) { /* non-json response */ }

    if (!res.ok) {
      const err = (data && data.error) || {};
      const code = err.code || (res.status === 401 ? 'UNAUTHORIZED' : res.status === 403 ? 'FORBIDDEN' : 'SERVER');
      throw {
        code,
        message: err.message || errorMessage(code),
        details: err.details || null,
        status: res.status,
      };
    }
    return data;
  }

  return {
    request,
    get: (url) => request('GET', url),
    post: (url, body) => request('POST', url, body),
    patch: (url, body) => request('PATCH', url, body),
    del: (url) => request('DELETE', url),
    errorMessage,
  };
})();
