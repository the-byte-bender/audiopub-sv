import { error, type RequestEvent } from "@sveltejs/kit";
import Subscription from "./database/models/subscription";
import { Audio, User } from "./database";
import { isMuted } from "./mutes";
import { findUserByParam } from "./users";

async function findSubscribedToUser(event: RequestEvent): Promise<User | null> {
    if (event.route.id == "/user/[id]") {
        return findUserByParam(event.params.id!);
    }
    if (event.route.id == "/listen/[id]") {
        const audio = await Audio.findByPk(event.params.id);
        return User.findByPk(audio?.userId);
    }
    return null;
}

export const subscribe = async (event: RequestEvent): Promise<any> => {
    if (!event.locals.user) {
        return error(403, "Forbidden");
    }

    const subscribedToUser = await findSubscribedToUser(event);
    if (!subscribedToUser) {
        return error(403, "Forbidden");
    }
    return subscribeToUser(event, subscribedToUser);
};

export async function subscribeToUser(
    event: RequestEvent,
    subscribedToUser: User,
): Promise<{ success: true }> {
    const user = event.locals.user;
    if (!user) {
        return error(403, "Forbidden");
    }

    if (user.id == subscribedToUser.id) {
        return error(403, "Forbidden");
    }

    // Subscribing to someone whose uploads you have hidden would only produce a
    // feed entry you never see.
    if (await isMuted(event, subscribedToUser.id)) {
        return error(409, "Unmute this user before subscribing to them");
    }

    try {
        await Subscription.findOrCreate({
            where: { subscriberId: user.id, subscribedToId: subscribedToUser.id },
        });
        return { success: true };
    } catch {
        return error(500, "Internal error");
    }
}

export const unsubscribe = async (event: RequestEvent): Promise<any> => {
    if (!event.locals.user) {
        return error(403, "Forbidden");
    }

    const subscribedToUser = await findSubscribedToUser(event);
    if (!subscribedToUser) {
        return error(403, "Forbidden");
    }
    return unsubscribeFromUser(event, subscribedToUser);
};

export async function unsubscribeFromUser(
    event: RequestEvent,
    subscribedToUser: User,
): Promise<{ success: true }> {
    const user = event.locals.user;
    if (!user) {
        return error(403, "Forbidden");
    }

    if (user.id == subscribedToUser.id) {
        return error(403, "Forbidden");
    }

    const deletedCount = await Subscription.destroy({ where: { subscriberId: user.id, subscribedToId: subscribedToUser.id } });

    if (deletedCount > 0) return { success: true }
    else return error(404, "Subscription not found")
}
