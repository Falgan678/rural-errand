(function () {
    var defaults = {
        apiBase: 'https://rural-errand-api-246677-4-1394833136.sh.run.tcloudbase.com/api',
        clientPage: 'index.html',
        loginPage: 'login.html',
        adminPage: 'admin-panel.html'
    };

    try {
        var host = (window.location && window.location.hostname || '').toLowerCase();
        var port = window.location && window.location.port || '';
        var isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '::1';

        if (isLocalHost) {
            // 本地预览时，优先走同源 /api，由本地反向代理转发到 FastAPI
            // 如果当前端口就是后端自己（FastAPI 演示模式 8001），也直接走 /api
            defaults.apiBase = '/api';

            // 当前端口是“纯静态预览”（如 8042/8080）时，直连本地 FastAPI 8001 端口
            if (port && port !== '8001') {
                defaults.apiBase = 'http://127.0.0.1:8001/api';
            }
        }
    } catch (e) {
        // 忽略，使用默认线上地址
    }

    window.__APP_CONFIG__ = Object.assign(defaults, window.__APP_CONFIG__ || {});
})();
