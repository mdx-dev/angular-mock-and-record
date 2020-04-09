const Http = require('./http.js');
const Record = require('./record.js');
const Mock = require('./mock.js');
const Auth = require('./auth.js');
const Utilities = require('./utilities.js');
let ignore = require('../../../mock.record.ignore.json');

class RequestHandler {

  constructor(config) {
    this.defaultDomain = config.domain;
    this.defaultContext = null;
    this.config = config;
    this.http = new Http(this.config);
    this.recorder = new Record(this.config);
    this.mock = new Mock();
    this.auth = new Auth();
    this.utilities = new Utilities();
  }

  handle(req, res) {

    const matchedPath = this.utilities.matchPath(req.path);
    const foundMock = this.mock.hasRequestBeenMocked(matchedPath, req.url);

    if (this.config.cors) {
      res = this.http.setCorsHeaders(req, res);
    }

    if (this.shouldMock(req.path)) {

      this.mock.setRequestAsMocked(req.path, req.body, req.headers);
      res.status(200).send(true);

    } else if (this.shouldSetDomain(req.path)) {

      this.setDomain(req.path);
      res.status(200).send(true);

    } else if (this.shouldSetContext(req.path)) {

      this.setContext(req.path);
      res.status(200).send(true);

    } else if (this.shouldClearMocks(req.path)) {

      this.mock.clearMockedRequests();
      this.auth._session_id = '';
      this.setDefaultDomain();
      this.setDefaultContext();
      res.status(200).send(true);

    } else if (this.shouldLogin(req.path)) {

      this.auth.login( this.auth.getUser(req.path), this.config.domain ).then(_session_id => {
        res.status(200).send(true);
      });

    } else if (this.shouldLogout(req.path)) {

      this.auth.logout().then(() => {
        res.status(200).send(true);
      });

    } else if (foundMock) {

      res.status(200).send(foundMock.response);

    } else {

      this.checkTapesForRecording(res, req, this.config.tape_name, this.defaultDomain);

    }
  }

  checkTapesForRecording(res, req, tapeToCheck, defaultDomain) {
    let recording = this.recorder.findRecording(req, tapeToCheck, defaultDomain);

    if (recording) {

      this.sendResponse(recording, res);

    } else {

      if (ignore.includes(req.path)) {
        res.status(204).send(null);
      }

      else if (!this.recordingAllowed()) {
        console.error('\nAn unrecorded request was detected:\n' + req.url);
        console.error('\nTo record new requests, use the `allow_recording` parameter\n');
        res.status(204).send(null);
      }

      else {

        this.http.get(req, this.auth._session_id).then(data => {

          this.sendResponse(data, res);
          data.mock_request_url = req.url;
          this.recorder.recordTape(data, req.path, tapeToCheck);
          console.log('\nRecorded request:  ' + req.url + '\n');

        });

      }

    }
  }

  sendResponse(data, res) {
    res = this.http.setResponseHeaders(data.headers, res);
    res.status(data.status).send(data.body);
  }

  recordingAllowed() {
    return !!( this.config.allow_recording || process.argv[2] === 'allow_recording' );
  }

  shouldMock(path) {
    return !!( path.includes('/mock/') );
  }

  shouldClearMocks(path) {
    return !!( path.includes('/clear') );
  }

  shouldLogin(path) {
    return !!( path.includes('/login/') );
  }

  shouldLogout(path) {
    return !!( path.includes('/logout/') );
  }

  shouldSetDomain(path) {
    return !!( path.includes('/domain/') );
  }

  shouldSetContext(path) {
    return !!( path.includes('/context/') );
  }

  refreshConfigs() {
    this.http = new Http(this.config);
    this.recorder = new Record(this.config);
  }

  setContext(path) {
    path = path.split('/');
    this.config.context = path[2];
    this.refreshConfigs();
  }

  setDomain(path) {
    path = path.split('/');
    this.config.domain = 'https://' + path[path.length - 1];
    this.refreshConfigs();
  }

  setDefaultDomain() {
    this.config.domain = this.defaultDomain;
    this.refreshConfigs();
  }

  setDefaultContext() {
    this.config.context = this.defaultContext;
    this.refreshConfigs();
  }

}

module.exports = RequestHandler;
