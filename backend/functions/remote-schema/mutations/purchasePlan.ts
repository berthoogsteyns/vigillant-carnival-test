import { gql } from '@apollo/client/core';
import { StripeCustomer, SubscriptionStatus, User, UserRole } from '../../common/apollo/types';
import { withJwt } from '../../common/enhancers';
import error from '../../common/error';
import stripe from '../../common/stripe';
import apollo from '../../common/apollo';
import shopify from '../../common/shopify';

export interface Args {
    studentId: string;
    planId: string;
    promoCode?: string;
}

export interface GetPlanAndStudentResults {
    promoCodes: {
        id: string;
    }[];

    product: {
        id: string;
        prices: {
            id: string;
        }[];
    };
    student: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        parentId: string;
        shopifyCustomerId?: string;
        subscription: {
            status: string;
            stripeSubscriptionId: string;
            cancelAt?: string;
        };
        stripe?: Pick<StripeCustomer, 'customerId'>;
        parent?: {
            id: string;
            firstName: string;
            lastName: string;
            email: string;
            shopifyCustomerId?: string;
            stripe?: Pick<StripeCustomer, 'customerId'>;
            subscriptions: {
                studentId: string;
                status: string;
                stripeSubscriptionId: string;
            }[];
        };
    };
}

export const GET_PLAN_AND_STUDENT = gql`
    query GetPlanAndStudent($studentId: uuid!, $planId: String!, $promoCode: String) {
        promoCodes: promo_codes(where: { code: { _eq: $promoCode } }) {
            id
        }
        product(id: $planId) {
            id
            prices(where: { active: { _eq: true } }) {
                id
            }
        }
        student(id: $studentId) {
            id
            firstName
            lastName
            email
            stripe {
                customerId
            }
            subscription {
                status
                stripeSubscriptionId
                cancelAt
            }
            shopifyCustomerId
            parentId: parent_id
            parent {
                id
                firstName
                lastName
                email
                shopifyCustomerId
                stripe {
                    customerId
                }
                subscriptions(order_by: [{ createdAt: asc }]) {
                    stripeSubscriptionId
                    status
                }
            }
        }
    }
`;

const purchasePlan = withJwt<Args>(
    async (parent, { studentId, planId, promoCode }, ctx) => {
        const { data } = await ctx.apollo.query<GetPlanAndStudentResults>({
            query: GET_PLAN_AND_STUDENT,
            variables: {
                studentId,
                planId,
                promoCode: promoCode || '', // graphql treats _eq+null as ALL values (pre-1.4.0)
            },
        });

        if (!data) {
            throw error.apolloError(error.ERRORS.rs_unexpected_error);
        }
        const isParent = ctx.jwt.role === UserRole.PARENT;
        const { student, product, promoCodes } = data;
        if (!student || (isParent && student.parentId !== ctx.jwt.userId)) {
            throw error.apolloError(error.ERRORS.rs_missing_reference, 'student');
        }
        if (!product) {
            throw error.apolloError(error.ERRORS.rs_missing_reference, 'plan');
        }
        if (!product.prices.length) {
            throw error.apolloError(error.ERRORS.rs_unexpected_error, '(plan_price)');
        }
        const stripeInfo = isParent ? student.parent?.stripe : student.stripe;

        if (!stripeInfo) {
            throw error.apolloError(error.ERRORS.rs_no_stripe_account);
        }

        // if (student.subscription) {
        //     throw error.apolloError(error.ERRORS.rs_already_subscribed);
        // }

        const user = (student.parent || student) as User;

        // returns subscription id
        const subscriptionId = stripe.createOrAddSubscription({
            customerId: stripeInfo.customerId,
            stripePriceId: product.prices[0].id,
            client: ctx.apollo,
            student,
            promoCodeId: promoCodes[0]?.id,
        });

        if (user.shopifyCustomerId) {
            return subscriptionId;
        }

        if (student.parent) {
            const studentSubscription = student.parent.subscriptions.find((subs) => subs.studentId === studentId);
            const isActive = studentSubscription ? studentSubscription.status === SubscriptionStatus.ACTIVE : false;
            const shopifyCustomerId = await shopify.createOrAddCustomer({
                userInfo: {
                    email: student.parent.email,
                    firstName: student.parent.firstName,
                    lastName: student.parent.lastName,
                    isActive,
                },
            });

            const studentWithShopifyCustomerId = { ...student, shopifyCustomerId };
            await apollo.users.update(ctx.apollo, studentId, studentWithShopifyCustomerId);
        } else {
            const isActive = student.subscription.status === SubscriptionStatus.ACTIVE;
            const shopifyCustomerId = await shopify.createOrAddCustomer({
                userInfo: {
                    email: student.email,
                    firstName: student.firstName,
                    lastName: student.lastName,
                    isActive,
                },
            });
            const studentWithShopifyCustomerId = { ...student, shopifyCustomerId };
            await apollo.students.update(ctx.apollo, studentId, studentWithShopifyCustomerId);
        }

        // TODO : implement integration with shopify
        // it should include the following
        // 1. Creating a customer with shopify( a new `common` lib) if not already created reference
        // Profile.shopifyCustomerId
        // 2. If already created then omit shopify setup
        // 2a. If a student has a `parent` then `student.shopifyCustomerId` should remain null and should update the
        // parent.shopifyCustomerId entry in the db from the return customerId from your create shopify customer api
        // call
        // 2b. If student doesn't have a parent then `student.shopifyCustomerId` should be populated with the
        // customerId from create shopify customer api call
        // 3. Add 2 new test cases that covers #1 and #2
        return subscriptionId;
    },
    [UserRole.PARENT, UserRole.STUDENT],
);

export default purchasePlan;
