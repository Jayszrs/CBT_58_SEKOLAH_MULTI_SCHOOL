// Same-origin transport for the existing school frontend.
function schoolRpcRunner(success, failure, userObject) {
  return new Proxy({}, {get: function(_, name) {
    if (name === 'then') return undefined;
    if (name === 'withSuccessHandler') return function(handler) { return schoolRpcRunner(handler, failure, userObject); };
    if (name === 'withFailureHandler') return function(handler) { return schoolRpcRunner(success, handler, userObject); };
    if (name === 'withUserObject') return function(value) { return schoolRpcRunner(success, failure, value); };
    return function() {
      var args = Array.prototype.slice.call(arguments);
      fetch('/api/school/__SCHOOL_SLUG__', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({method: name, args: args})})
        .then(function(response) { return response.json(); })
        .then(function(wire) { if (!wire.ok) throw Error(wire.error || 'Permintaan gagal.'); if (success) success(wire.result, userObject); })
        .catch(function(error) { if (failure) failure(error, userObject); });
    };
  }});
}
const google = {script: {run: schoolRpcRunner()}};
