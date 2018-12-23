const Alexa = require('ask-sdk');

const constants = require('./constants');
const functions = require('./functions');

const { responses } = constants;

// todo add a simple sponsored by APL image //
const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
  },
  async handle(handlerInput) {
    const { attributesManager, responseBuilder } = handlerInput;
    const sessionAttributes = attributesManager.getSessionAttributes();
    const persistentAttributes = await attributesManager.getPersistentAttributes();
    const { speechText } = responses.launchResponse;
    const salutation = !persistentAttributes.newUser
      ? functions.shuffle(constants.phrasePool.salutation)[0]
      : responses.launchResponse.firstUse;
    persistentAttributes.passTo = 'PickLanguageIntent';

    // create language string
    const { languages } = constants;
    const languageString = functions.getLanguageString(languages);

    if (persistentAttributes.newUser) {
      persistentAttributes.newUser = false;
    }

    sessionAttributes.repeatText =
      'Which language model would you like to hear this in?';
    // * just save it here: not used anywhere else * //
    await attributesManager.savePersistentAttributes();

    return responseBuilder
      .speak(
        `${salutation} ${speechText} ${languageString}
          <break time="0.5s" /> Which language model would you like to hear this in?`
      )
      .reprompt('Which language model would you like to hear this in?')
      .getResponse();
  },
};

// todo how to handle user saying language that we don't have yet ?? //
const PickLanguageInProgress = {
  canHandle(handlerInput) {
    const { request } = handlerInput.requestEnvelope;

    return (
      request.type === 'IntentRequest' &&
      (request.intent.name === 'PickLanguageIntent' &&
        request.dialogState !== 'COMPLETED')
    );
  },
  async handle(handlerInput) {
    const { responseBuilder } = handlerInput;

    return responseBuilder.addDelegateDirective().getResponse();
  },
};

const PickLanguageInfoCompleted = {
  canHandle(handlerInput) {
    const { request } = handlerInput.requestEnvelope;
    return (
      request.type === 'IntentRequest' &&
      request.intent.name === 'PickLanguageIntent'
    );
  },
  async handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    sessionAttributes.passTo = false;

    return PlayTrackIntentHandler.handle(handlerInput);
  },
};

const PlayTrackIntentHandler = {
  canHandle(handlerInput) {
    const { request } = handlerInput.requestEnvelope;
    return (
      request.type === 'IntentRequest' &&
      request.intent.name === 'PlayTrackIntent'
    );
  },
  async handle(handlerInput) {
    // just setting everything up here before passing to handler
    const { attributesManager } = handlerInput;
    const sessionAttributes = attributesManager.getSessionAttributes();
    const filledSlots = handlerInput.requestEnvelope.request.intent.slots;
    const slotValues = functions.getSlotValues(filledSlots);
    const resolvedLanguage = slotValues.language.resolved;
    const language = constants.languages.includes(resolvedLanguage)
      ? resolvedLanguage
      : 'American';

    const { url } = constants.audio[language];
    console.log(
      `language ${language} url ${url}  token ${sessionAttributes.token}`
    );

    return AudioPlayerEventHandler.handle(handlerInput, url);
  },
};

// handle audio events here as well --- not ideal but works because only 1 track //
const AudioPlayerEventHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type.startsWith('AudioPlayer.');
  },
  handle(handlerInput, url) {
    const { responseBuilder, requestEnvelope } = handlerInput;

    // if already playing do nothing //
    // this is just clearing system exception errors //
    if (requestEnvelope.context.AudioPlayer.offsetInMilliseconds) {
      return;
    }

    return (
      responseBuilder
        .withShouldEndSession(true)
        // use url for token, when we resume can use token for url //
        .addAudioPlayerPlayDirective('REPLACE_ALL', url, url, 0, null)
        .getResponse()
    );
  },
};

const ResumePlayingHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type ===
        'PlaybackController.PlayCommandIssued' ||
      (handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
        handlerInput.requestEnvelope.request.intent.name ===
          'AMAZON.ResumeIntent')
    );
  },
  async handle(handlerInput) {
    const { requestEnvelope, responseBuilder } = handlerInput;
    const { offsetInMilliseconds, token } = requestEnvelope.context.AudioPlayer;

    console.log(
      `resuming playback >>> offset = ${offsetInMilliseconds} token = ${token}`
    );

    if (offsetInMilliseconds > 0) {
      return (
        responseBuilder
          .withShouldEndSession(true)
          // using token for url like a boss //
          .addAudioPlayerPlayDirective(
            'REPLACE_ALL',
            token,
            token,
            offsetInMilliseconds,
            null
          )
          .getResponse()
      );
    }
    LaunchRequestHandler.handle(handlerInput);
  },
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent'
    );
  },
  async handle(handlerInput) {
    const { attributesManager, responseBuilder } = handlerInput;
    const sessionAttributes = attributesManager.getSessionAttributes();
    const { speechText } = responses.helpResponse;

    // create language string
    const { languages } = constants;
    const languageString = functions.getLanguageString(languages);

    sessionAttributes.repeatText = `${speechText} ${languageString}`;
    sessionAttributes.passTo = false;

    return responseBuilder
      .speak(speechText + languageString)
      .reprompt(speechText + languageString)
      .getResponse();
  },
};

const YesIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'AMAZON.YesIntent'
    );
  },
  async handle(handlerInput) {
    const { attributesManager } = handlerInput;
    const sessionAttributes = attributesManager.getSessionAttributes();

    // if (sessionAttributes.passTo) {
    //   switch (sessionAttributes.passTo) {
    //     case 'HelloWorldIntentHandler':
    //       console.log(sessionAttributes);
    //       return HelloWorldIntentHandler.handle(handlerInput);
    //     default:
    //       throw new Error(
    //         `In yes intent switch. Most likely this error is because of an invalid 'passTo' value >>> sessionAttributes.passTo = ${
    //           sessionAttributes.passTo
    //         } <<<`
    //       );
    //   }
    // }

    // alexa didn't as a yes/no question --> fallback //
    return FallBackHandler.handle(handlerInput);
  },
};

const NoIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name === 'AMAZON.NoIntent'
    );
  },
  async handle(handlerInput) {
    const { attributesManager, responseBuilder } = handlerInput;
    const sessionAttributes = attributesManager.getSessionAttributes();

    // if (sessionAttributes.passTo) {
    //   switch (sessionAttributes.passTo) {
    //     case 'HelloWorldIntentHandler':
    //       return responseBuilder
    //         .speak(functions.shuffle(constants.phrasePool.valediction)[0])
    //         .getResponse();
    //     default:
    //       throw new Error(
    //         `In no intent switch. Most likely this error is because of an invalid 'passTo' value >>> sessionAttributes.passTo = ${
    //           sessionAttributes.passTo
    //         } <<<`
    //       );
    //   }
    // }

    // alexa didn't ask a yes/no question --> fallback //
    return FallBackHandler.handle(handlerInput);
  },
};

const RepeatIntentHandler = {
  canHandle(handlerInput) {
    const { request } = handlerInput.requestEnvelope;
    return (
      request.type === 'IntentRequest' &&
      request.intent.name === 'AMAZON.RepeatIntent'
    );
  },
  async handle(handlerInput) {
    const { attributesManager, responseBuilder } = handlerInput;
    const sessionAttributes = attributesManager.getSessionAttributes();
    const speechText = sessionAttributes.repeatText;
    const repromptText = speechText;

    return responseBuilder
      .speak(speechText)
      .reprompt(repromptText)
      .getResponse();
  },
};

const ResetIntentHandler = {
  canHandle(handlerInput) {
    const { request } = handlerInput.requestEnvelope;
    return (
      request.type === 'IntentRequest' && request.intent.name === 'ResetIntent'
    );
  },
  async handle(handlerInput) {
    const { attributesManager, responseBuilder } = handlerInput;
    const sessionAttributes = attributesManager.getSessionAttributes();
    sessionAttributes.testReset = true; // this line is just for running tests
    attributesManager.setSessionAttributes({});
    attributesManager.setPersistentAttributes(
      constants.persistentAttributesAtStart
    );
    await attributesManager.savePersistentAttributes();
    return responseBuilder.speak('Skill is reset. Good-bye').getResponse();
  },
};

const FallBackHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      handlerInput.requestEnvelope.request.intent.name ===
        'AMAZON.FallbackIntent'
    );
  },
  async handle(handlerInput) {
    const { responseBuilder } = handlerInput;
    const speechText = functions.shuffle(constants.phrasePool.fallback)[0];
    const { languages } = constants;
    const languageString = functions.getLanguageString(languages);

    const hint = `Your language model choices are ${languageString}`;

    return responseBuilder
      .speak(`${speechText}<break time='0.25s' />. ${hint}`)
      .reprompt(`${hint}`)
      .getResponse();
  },
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === 'IntentRequest' &&
      (handlerInput.requestEnvelope.request.intent.name ===
        'AMAZON.StopIntent' ||
        handlerInput.requestEnvelope.request.intent.name ===
          'AMAZON.CancelIntent' ||
        handlerInput.requestEnvelope.request.intent.name ===
          'AMAZON.PauseIntent')
    );
  },
  async handle(handlerInput) {
    const { responseBuilder } = handlerInput;

    console.log('user stopped, or canceled some request');

    return responseBuilder.addAudioPlayerStopDirective().getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(
      `Session ended >>> Handler Input: ${JSON.stringify(handlerInput)}`
    );
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  async handle(handlerInput, error) {
    const { responseBuilder } = handlerInput;
    console.log(
      `Error handler: Error: ${error} Handler Input: ${JSON.stringify(
        handlerInput
      )}`
    );

    const speechText =
      'There appears to be something wrong. Please try again in a few moments';
    return responseBuilder.speak(speechText).getResponse();
  },
};

const SystemExceptionHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type ===
      'System.ExceptionEncountered'
    );
  },
  handle(handlerInput) {
    console.log(
      `System Exception >>> Handler Input: ${JSON.stringify(
        handlerInput.requestEnvelope
      )}`
    );
  },
};

const LogJsonRequestInterceptor = {
  async process(handlerInput) {
    console.log(
      `REQUEST ENVELOPE = ${JSON.stringify(handlerInput.requestEnvelope)}`
    );
  },
};

const skillBuilder = Alexa.SkillBuilders.standard();
exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequestHandler,
    HelpIntentHandler,
    PickLanguageInProgress,
    PickLanguageInfoCompleted,
    PlayTrackIntentHandler,
    ResumePlayingHandler,
    AudioPlayerEventHandler,
    YesIntentHandler,
    NoIntentHandler,
    RepeatIntentHandler,
    ResetIntentHandler,
    CancelAndStopIntentHandler,
    FallBackHandler,
    SystemExceptionHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .withTableName(constants.skill.dynamoDBTableName)
  .withAutoCreateTable(true)
  .addRequestInterceptors(LogJsonRequestInterceptor)
  .lambda();
