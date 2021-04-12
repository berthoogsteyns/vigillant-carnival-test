import { ApolloClient, HttpLink, InMemoryCache, gql } from '@apollo/client/core';
import { fetch } from 'cross-fetch';

const SUBSCRIBED = 'subscribed';

const shopifyClient = new ApolloClient({
    link: new HttpLink({
        uri: process.env.SHOPIFY_API_ENDPOINT, // 'https://vigilant-carnival-dev.myshopify.com/admin/api/2021-04/graphql.json',
        fetch,
        headers: {
            'X-Shopify-Access-Token': process.env.SHOPIFY_API_KEY, // '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',
        },
    }),
    cache: new InMemoryCache(),
});

export interface CreateShopifyCustomerArgs {
    userInfo: {
        firstName: string;
        lastName: string;
        email: string;
        isActive: boolean;
    };
}

export interface CreateOrUpdateShopifyCustomerOutput {
    customer: {
        id: string;
    };
    userErrors: {
        field?: string[];
        message: string;
    }[];
}

export interface GetCustomerOutput {
    tags: string[];
}

export const GET_CUSTOMER_BY_ID = gql`
    query GetCustomerById($id: ID!) {
        customer(id: $id) {
            tags
        }
    }
`;

export const UPDATE_CUSTOMER = gql`
    mutation customerUpdate($input: CustomerInput!) {
        customerUpdate(input: $input) {
            customer {
                id
            }
            userErrors {
                field
                message
            }
        }
    }
`;

export const CREATE_CUSTOMER = gql`
    mutation customerCreate($input: CustomerInput!) {
        customerCreate(input: $input) {
            customer {
                id
            }
            userErrors {
                field
                message
            }
        }
    }
`;

// interface Shopify

const createCustomer = async ({ userInfo }: CreateShopifyCustomerArgs) => {
    const tags = userInfo.isActive ? [SUBSCRIBED] : [];
    const { data } = await shopifyClient.mutate<CreateOrUpdateShopifyCustomerOutput>({
        mutation: CREATE_CUSTOMER,
        variables: {
            input: { email: userInfo.email, firstName: userInfo.firstName, lastName: userInfo.lastName, tags },
        },
    });
    return data?.customer.id;
};

const removeSubscribedTag = async (shopifyCustomerId: string) => {
    const { data } = await shopifyClient.query<string[]>({
        query: GET_CUSTOMER_BY_ID,
        variables: {
            id: shopifyCustomerId,
        },
    });

    const filteredTags = data ? data.filter((s) => s !== SUBSCRIBED) : [];

    const updatedCustomer = await shopifyClient.mutate<CreateOrUpdateShopifyCustomerOutput>({
        mutation: UPDATE_CUSTOMER,
        variables: {
            input: { id: shopifyCustomerId, tags: filteredTags },
        },
    });

    return updatedCustomer.data?.customer.id;
};

export default { createOrAddCustomer: createCustomer, removeSubscribedTag };
