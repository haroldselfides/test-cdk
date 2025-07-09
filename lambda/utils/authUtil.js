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
        // 'sub' is the universally unique and immutable identifier for a user in Cognito.
        // It's the best choice for a stable user ID.
        const userIdentity = claims.sub || claims['cognito:username'] || claims.email;
        if (userIdentity) {
            console.log(`Request initiated by authenticated user: ${userIdentity}`);
            return userIdentity;
        }
    }

    console.warn('Could not determine authenticated user from event context. Falling back to "system".');
    return 'system'; // A safe default
};

/**
 * Extracts the user's role from the 'custom:role' attribute in the Cognito token claims.
 * @param {object} event - The API Gateway Lambda event object.
 * @returns {string | null} The user's role (e.g., 'hr_admin', 'manager_admin') or null if not found.
 */
const getUserRole = (event) => {
    const claims = event.requestContext?.authorizer?.claims;
    const role = claims ? claims['custom:role'] : null;
    if (!role) {
        console.warn("User role ('custom:role') not found in Cognito token claims.");
    }
    return role;
};

/**
 * Enforces Role-Based Access Control (RBAC) by checking if the user's role is in an allowed list.
 * @param {object} event - The API Gateway Lambda event object.
 * @param {string[]} allowedRoles - An array of role strings that are permitted to access the resource.
 * @returns {boolean} True if the user's role is in the allowed list, false otherwise.
 */
const isAuthorized = (event, allowedRoles) => {
    const userRole = getUserRole(event);
    const requestingUser = getRequestingUser(event);

    if (!userRole) {
        console.error(`Authorization failed for user '${requestingUser}': No role found in token.`);
        return false;
    }

    if (allowedRoles.includes(userRole)) {
        console.log(`Authorization successful for user '${requestingUser}' with role '${userRole}'.`);
        return true;
    } else {
        console.error(`Authorization FAILED for user '${requestingUser}'. Role '${userRole}' is not in the allowed list: [${allowedRoles.join(', ')}].`);
        return false;
    }
};

module.exports = {
    getRequestingUser,
    isAuthorized,
};