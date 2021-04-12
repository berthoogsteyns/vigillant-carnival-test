import apollo from '../../common/apollo';
import shopify from '../../common/shopify';

import { SubscriptionStatus, User } from '../../common/apollo/types';
import { withApolloClient } from '../../common/enhancers';
import newLogger from '../../common/newLogger';

import { SubscriptionRow } from '../rows';

const logger = newLogger('subscriptions/onSubscriptionDeleted');

export const onSubscriptionUpdated = async (updated: SubscriptionRow, old: SubscriptionRow) => {
    const client = await withApolloClient();
    const subscriptions = await apollo.subscriptions.byStudentId(client, updated.student_id);

    logger.info("Subscription's student data retrieved: ", subscriptions);

    if (!subscriptions || !subscriptions.student) {
        logger.error("Subscription's student data not found");
        return false;
    }

    if (updated.status === old.status) {
        logger.error("Subscription's were not changed");
        return false;
    }

    const user = (subscriptions.student.parent || subscriptions.student) as User;

    if (user.shopifyCustomerId && old.status !== SubscriptionStatus.ACTIVE) {
        const shopifyCustomerId = await shopify.removeSubscribedTag(user.shopifyCustomerId);
        return !!shopifyCustomerId;
    }

    return false;
};
