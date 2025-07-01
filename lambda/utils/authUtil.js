// lambda/utils/authUtil.js

/**
 * Extracts the user's identity from the API Gateway event context.
 * It checks for Cognito claims first.
 * @param {object} event - The API Gateway Lambda event object.
 * @returns {string} The identity of the user (username, email, or sub) or a default value.
 */
const getRequestingUser = (event) => {
    // When using a Cognito User Pool Authorizer, claims are nested under `authorizer.claims`
    const claims = event.requestContext?.authorizer?.claims;

    if (claims) {
        // 'cognito:username' is the most common, but 'email' or 'sub' are good fallbacks.
        const userIdentity = claims['cognito:username'] || claims.email || claims.sub;
        if (userIdentity) {
            console.log(`Request initiated by authenticated user: ${userIdentity}`);
            return userIdentity;
        }
    }

    console.warn('Could not determine authenticated user from event context. Falling back to "system".');
    return 'system'; // A safe default
};

module.exports = {
    getRequestingUser,
};