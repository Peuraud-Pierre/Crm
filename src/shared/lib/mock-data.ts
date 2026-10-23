type Customer = {
    id: string
    name: string
    email: string
    phone: string
    company: string
    address: string
    city: string
    postalCode: string
    country: string
    createdAt: Date
    totalSpent: number
    orderCount: number
}

type Product = {
    id: string
    name: string
    description: string
    price: number
    stock: number
    category: string
    sku: string
}

type Order = {
    id: string
    orderNumber: string
    customerId: string
    customer: Customer
    items: OrderItem[]
    status: string
    total: number
    createdAt: Date
    updatedAt: Date
    notes?: string
}

type OrderItem = {
    id: string
    productId: string
    product: Product
    quantity: number
    unitPrice: number
    total: number
}

export type Invoice = {
    id: string
    invoiceNumber: string
    orderId: string
    order: Order
    customerId: string
    customer: Customer
    status: string
    dueDate: Date
    amount: number
    paidAmount: number
    createdAt: Date
    sentAt: Date
    paidAt?: Date
}

// Données internes utilisées uniquement pour construire mockInvoices (consommé par le CRM,
// src/features/crm/components/Client/fiche.tsx). Les features Customers/Products/Orders/Quotes/
// Calendar qui exportaient ces mocks vers l'extérieur ont été supprimées (code mort Lovable
// jamais routé, voir docs/PLAN_ASSAINISSEMENT.md Phase 1) — ces consts redeviennent privées
// au module plutôt que d'être supprimées, car mockInvoices en dépend.
const mockCustomers: Customer[] = [
    {
        id: "1",
        name: "Sophie Martin",
        email: "sophie.martin@entreprise.fr",
        phone: "+33 6 12 34 56 78",
        company: "Tech Solutions SA",
        address: "123 Avenue des Champs",
        city: "Paris",
        postalCode: "75008",
        country: "France",
        createdAt: new Date("2024-01-15"),
        totalSpent: 45680,
        orderCount: 12,
    },
    {
        id: "2",
        name: "Alex Dubois",
        email: "p.dubois@industrie.fr",
        phone: "+33 6 98 76 54 32",
        company: "Industries Dubois",
        address: "456 Rue de la République",
        city: "Lyon",
        postalCode: "69002",
        country: "France",
        createdAt: new Date("2024-02-20"),
        totalSpent: 89230,
        orderCount: 23,
    },
    {
        id: "3",
        name: "Marie Laurent",
        email: "marie.laurent@services.fr",
        phone: "+33 6 45 67 89 01",
        company: "Services Plus",
        address: "789 Boulevard Victor Hugo",
        city: "Marseille",
        postalCode: "13001",
        country: "France",
        createdAt: new Date("2024-03-10"),
        totalSpent: 34560,
        orderCount: 8,
    },
]

const mockProducts: Product[] = [
    {
        id: "1",
        name: "Ordinateur Portable Pro",
        description:
            "Ordinateur portable haute performance pour professionnels",
        price: 1299.99,
        stock: 45,
        category: "Informatique",
        sku: "LAP-PRO-001",
    },
    {
        id: "2",
        name: 'Écran 4K 32"',
        description: "Moniteur 4K professionnel avec technologie IPS",
        price: 599.99,
        stock: 32,
        category: "Informatique",
        sku: "MON-4K-032",
    },
    {
        id: "3",
        name: "Suite Logicielle Business",
        description: "Licence annuelle pour suite logicielle complète",
        price: 299.99,
        stock: 100,
        category: "Logiciels",
        sku: "SOFT-BUS-001",
    },
    {
        id: "4",
        name: "Serveur Cloud Premium",
        description: "Hébergement cloud haute disponibilité - mensuel",
        price: 199.99,
        stock: 50,
        category: "Services",
        sku: "SRV-CLD-001",
    },
    {
        id: "5",
        name: "Support Technique 24/7",
        description: "Support technique prioritaire - forfait mensuel",
        price: 99.99,
        stock: 200,
        category: "Services",
        sku: "SUP-24-001",
    },
]

const mockOrders: Order[] = [
    {
        id: "1",
        orderNumber: "CMD-2024-001",
        customerId: "1",
        customer: mockCustomers[0],
        items: [
            {
                id: "1",
                productId: "1",
                product: mockProducts[0],
                quantity: 2,
                unitPrice: 1299.99,
                total: 2599.98,
            },
            {
                id: "2",
                productId: "2",
                product: mockProducts[1],
                quantity: 2,
                unitPrice: 599.99,
                total: 1199.98,
            },
        ],
        status: "processing",
        total: 3799.96,
        createdAt: new Date("2024-11-20"),
        updatedAt: new Date("2024-11-21"),
        notes: "Livraison urgente demandée",
    },
    {
        id: "2",
        orderNumber: "CMD-2024-002",
        customerId: "2",
        customer: mockCustomers[1],
        items: [
            {
                id: "3",
                productId: "3",
                product: mockProducts[2],
                quantity: 5,
                unitPrice: 299.99,
                total: 1499.95,
            },
        ],
        status: "completed",
        total: 1499.95,
        createdAt: new Date("2024-11-18"),
        updatedAt: new Date("2024-11-19"),
    },
    {
        id: "3",
        orderNumber: "CMD-2024-003",
        customerId: "3",
        customer: mockCustomers[2],
        items: [
            {
                id: "4",
                productId: "4",
                product: mockProducts[3],
                quantity: 1,
                unitPrice: 199.99,
                total: 199.99,
            },
            {
                id: "5",
                productId: "5",
                product: mockProducts[4],
                quantity: 1,
                unitPrice: 99.99,
                total: 99.99,
            },
        ],
        status: "pending",
        total: 299.98,
        createdAt: new Date("2024-11-22"),
        updatedAt: new Date("2024-11-22"),
    },
]

// Mock Invoices
export const mockInvoices: Invoice[] = [
    {
        id: "1",
        invoiceNumber: "FAC-2024-001",
        orderId: "1",
        order: mockOrders[0],
        customerId: "1",
        customer: mockCustomers[0],
        status: "sent",
        dueDate: new Date("2024-12-20"),
        amount: 3799.96,
        paidAmount: 0,
        createdAt: new Date("2024-11-20"),
        sentAt: new Date("2024-11-21"),
    },
    {
        id: "2",
        invoiceNumber: "FAC-2024-002",
        orderId: "2",
        order: mockOrders[1],
        customerId: "2",
        customer: mockCustomers[1],
        status: "paid",
        dueDate: new Date("2024-12-18"),
        amount: 1499.95,
        paidAmount: 1499.95,
        createdAt: new Date("2024-11-18"),
        sentAt: new Date("2024-11-18"),
        paidAt: new Date("2024-11-19"),
    },
]

