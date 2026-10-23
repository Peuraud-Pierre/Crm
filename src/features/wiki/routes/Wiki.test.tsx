/* eslint-disable react-x/no-unnecessary-use-prefix -- noms imposés par le mock des hooks */
import { expect, rstest, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import type { WikiArticle } from "../types/wiki-article.types"

const publishedArticle: WikiArticle = {
    id: "a1",
    category_id: null,
    title: "Guide de démarrage",
    slug: null,
    body: "# Bienvenue\n\nContenu **markdown**.",
    sections: [],
    status: "published",
    position: 0,
    created_by: null,
    created_at: "2026-06-29T00:00:00Z",
    updated_at: "2026-06-29T00:00:00Z",
}

rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    // Mock du hook réel useAuth : doit garder le préfixe "use".
    useAuth: () => ({
        user: { user_id: "user-1" },
        hasPermission: () => false,
    }),
}))

rstest.mock("../hooks/data/useWikiArticles", () => ({
    useWikiArticles: () => ({
        articles: [publishedArticle],
        loading: false,
        error: null,
        fetchArticles: async () => {},
        createArticle: async () => publishedArticle,
        updateArticle: async () => {},
        deleteArticle: async () => {},
    }),
}))

rstest.mock("../hooks/data/useWikiCategories", () => ({
    useWikiCategories: () => ({
        categories: [],
        loading: false,
        error: null,
        fetchCategories: async () => {},
        createCategory: async () => ({}),
        updateCategory: async () => {},
        deleteCategory: async () => {},
    }),
}))

import Wiki from "./Wiki"

test("Wiki consultation affiche les articles publiés", () => {
    render(<Wiki />)
    expect(screen.getByText("Guide de démarrage")).toBeInTheDocument()
})
