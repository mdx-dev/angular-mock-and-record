const Utilities = require('./utilities.js');

class Record {

  constructor(config) {
    this.fs = require('fs');
    this.config = config;
    this.utilities = new Utilities();
  }

  findRecording(req, label, defaultDomain) {
    let recording = this.recordingExists(req.path, req.url, label, defaultDomain);

    if (recording) {

      if (this.config.cleanup == true) {
        this.editTape(recording, req.path, label);
      }

      return recording;
    }

    return null;
  }

  recordingExists(requestPath, requestUrl, label, defaultDomain) {
    let out = null;
    let tape = this.tapeExists(requestPath, label);

    if (tape) {
      let recording = this.isRecordingOnTape(requestUrl, tape);
      let shouldCheckContext = this.config.context;

      if (recording.length) {

        // when no context & default domain
        if (!shouldCheckContext && this.config.domain === defaultDomain) {
          // return the first recording if: it has no context AND domain is either empty or default
          out = recording ? recording.find(rec => !!((!rec.domain || (rec.domain === defaultDomain)) && !rec.context)) : null;
        }

        // when no context and client specific domain
        if (!shouldCheckContext && this.config.domain != defaultDomain) {
          // return the first recording if: it has no context AND matches requested domain
          out = recording ? recording.find(rec => !!(rec.domain === this.config.domain && !rec.context)) : null;

        }

        // when context enabled
        if (shouldCheckContext) {
          // return the first recording if: the domain matches requested domain AND context matches requested context
          out = recording ? recording.find(rec => !!(rec.domain === this.config.domain && rec.context === this.config.context)) : null;

        }

      }
      tape = null; // clear to free memory
    }

    return out;
  }

  tapeExists(requestPath, label) {
    try {
      return JSON.parse(
        this.fs.readFileSync(
          this.config.recording_dir + this.utilities.normalizePath(requestPath) + '/' + label + '.json', 'utf8'
        )
      );
    } catch(error) {
      return null;
    }
  }

  editTape(recording, requestPath, label) {
    let tape = this.tapeExists(requestPath, label);
    let index = 0;
    let foundIndex = -1
    let modified;

    tape.forEach(obj => {
      if (obj.mock_request_url == recording.mock_request_url && obj.domain == recording.domain && obj.context == recording.context) {
        foundIndex = index;
      }

      index++;
    });

    if (foundIndex > -1) {
      modified = tape[foundIndex];
      modified['used'] = true;
      tape[foundIndex] = modified;
      this.fs.writeFileSync(
        this.config.recording_dir + this.utilities.normalizePath(requestPath) + '/' + label + '.json',
        JSON.stringify(tape, null, 2) + '\r\n'
      );
    }
  }

  isRecordingOnTape(requestUrl, tape) {
    return tape.filter(recording => {
      let redactedRecordingUrl;
      let redactedRequestUrl;

      this.config.exclude_params.forEach(param => {
        redactedRecordingUrl = this.utilities.removeParam(param, redactedRecordingUrl || recording.mock_request_url);
        redactedRequestUrl = this.utilities.removeParam(param, redactedRequestUrl || requestUrl);
      });

      this.config.normalize_params.forEach(param => {
        redactedRecordingUrl = this.utilities.normalizeParam(param, redactedRecordingUrl || recording.mock_request_url);
        redactedRequestUrl = this.utilities.normalizeParam(param, redactedRequestUrl || requestUrl);
      });

      if (redactedRecordingUrl === redactedRequestUrl) {
        return recording;
      }
    });
  }

  recordTape(data, requestPath, label) {
    let out = [];
    let dir = this.config.recording_dir + this.utilities.normalizePath(requestPath);
    let tape = this.tapeExists(requestPath, label);

    if (tape) {
      out = tape;
    }

    if (this.config.domain) {
      data.domain = this.config.domain;
    }

    if (this.config.context) {
      data.context = this.config.context;
    }

    out.push(data);

    if (!this.fs.existsSync(dir)){
      this.utilities.mkDirByPathSync(dir);
    }

    this.fs.writeFileSync(
      dir + '/' + label + '.json',
      JSON.stringify(out, null, 2) + '\r\n'
    );
  }
}

module.exports = Record;
