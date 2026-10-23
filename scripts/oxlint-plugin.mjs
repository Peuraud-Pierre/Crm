// Règles locales pour oxlint (chargé via `jsPlugins` dans .oxlintrc.json).
//
// `no-restricted-syntax` n'existe pas dans oxlint : on la reproduit à
// l'identique (mêmes options `{ selector, message }` qu'ESLint), les
// sélecteurs esquery étant supportés par l'API des plugins JS.
const noRestrictedSyntax = {
    meta: {
        schema: {
            type: "array",
            items: {
                type: "object",
                properties: { selector: { type: "string" }, message: { type: "string" } },
                required: ["selector", "message"],
            },
        },
    },
    create(context) {
        return Object.fromEntries(
            context.options.map(({ selector, message }) => [
                selector,
                (node) => context.report({ node, message }),
            ]),
        )
    },
}

export default {
    meta: { name: "nokk-project" },
    rules: { "no-restricted-syntax": noRestrictedSyntax },
}
