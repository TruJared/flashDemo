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
    const persistentAttributes =
      (await attributesManager.getPersistentAttributes()) ||
      constants.persistentAttributesAtStart;
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
    persistentAttributes.repeatText =
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
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    sessionAttributes.passTo = false;

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
    const { attributesManager, responseBuilder } = handlerInput;
    const filledSlots = handlerInput.requestEnvelope.request.intent.slots;
    const slotValues = functions.getSlotValues(filledSlots);
    console.log(JSON.stringify(slotValues));

    const resolvedLanguage = slotValues.language.resolved;
    const language = constants.languages.includes(resolvedLanguage)
      ? resolvedLanguage
      : 'English';
    const { url, token } = constants.audio[language];

    console.log(`language ${language} url ${url} `);

    return responseBuilder
      .speak()
      .withShouldEndSession(true)
      .addAudioPlayerPlayDirective('REPLACE_ALL', url, token, 0, null)
      .getResponse();
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
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    const speechText = functions.shuffle(constants.phrasePool.fallback)[0];
    const hint =
      sessionAttributes.passTo === 'PickLanguageIntent'
        ? `You could start off your choice by saying ${
            functions.shuffle(constants.hints)[0]
          }`
        : '';

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
          'AMAZON.CancelIntent')
    );
  },
  async handle(handlerInput) {
    const { responseBuilder } = handlerInput;

    console.log('user stopped, or canceled some request');

    return responseBuilder
      .speak('')
      .addAudioPlayerStopDirective()
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(
      `Session ended with reason: ${
        handlerInput.requestEnvelope.request.reason
      }`
    );
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  async handle(handlerInput, error) {
    const { responseBuilder } = handlerInput;
    console.log(`Error handled: ${error}`);
    console.log(
      `Session ended with reason >> ${
        handlerInput.requestEnvelope.request.reason
      } <<
      ${JSON.stringify(handlerInput.requestEnvelope)}`
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
      `Session ended with reason >> ${
        handlerInput.requestEnvelope.request.reason
      } <<
      ${JSON.stringify(handlerInput.requestEnvelope)}`
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
