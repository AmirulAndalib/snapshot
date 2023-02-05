import { computed, ref } from 'vue';
import { useModal } from '@/composables/useModal';
import { useWeb3 } from '@/composables/useWeb3';
import { useApolloQuery } from '@/composables/useApolloQuery';
import { getInstance } from '@snapshot-labs/lock/plugins/vue3';
import { FOLLOWS_QUERY } from '@/helpers/queries';
import { useAliasAction } from '@/composables/useAliasAction';
import client from '@/helpers/clientEIP712';
import { useSpaceSubscription } from './useSpaceSubscription';

const following = ref<{ space: { id: string }; follower: string }[]>([]);
const isLoadingFollows = ref(false);

const spaceFollowers = ref<{ space: { id: string }; follower: string }[]>([]);
const isLoadingSpaceFollowers = ref(false);

export function useFollowSpace(spaceId = '') {
  const { web3, web3Account } = useWeb3();
  const { modalAccountOpen } = useModal();
  const { apolloQuery } = useApolloQuery();
  const { setAlias, aliasWallet, isValidAlias, checkAlias } = useAliasAction();
  const { toggleSubscription, isSubscribed } = useSpaceSubscription(spaceId);

  const loadingFollow = ref('');

  const followingSpaces = computed(() => following.value.map(f => f.space.id));

  const isFollowing = computed(() =>
    following.value.some(
      f => f.space.id === spaceId && f.follower === web3Account.value
    )
  );

  async function loadFollows(first = 500) {
    const { isAuthenticated } = getInstance();

    if (!isAuthenticated.value) return;

    isLoadingFollows.value = true;
    try {
      following.value = await apolloQuery(
        {
          query: FOLLOWS_QUERY,
          variables: {
            first,
            follower_in: web3Account.value
          }
        },
        'follows'
      );

      isLoadingFollows.value = false;
    } catch (e) {
      isLoadingFollows.value = false;
      console.error(e);
    }
  }

  async function loadSpaceFollowers(first = 500) {
    isLoadingSpaceFollowers.value = true;
    try {
      spaceFollowers.value = await apolloQuery(
        {
          query: FOLLOWS_QUERY,
          variables: {
            first,
            space_in: spaceId
          }
        },
        'follows'
      );

      isLoadingSpaceFollowers.value = false;
    } catch (e) {
      isLoadingSpaceFollowers.value = false;
      console.error(e);
    }
  }

  function clickFollow(id: string) {
    !web3.value.authLoading
      ? web3Account.value
        ? follow(id)
        : (modalAccountOpen.value = true)
      : null;
  }

  async function follow(id: string) {
    loadingFollow.value = id;
    try {
      await checkAlias();
      if (!aliasWallet.value || !isValidAlias.value) {
        await setAlias();
        follow(id);
      } else {
        if (isFollowing.value) {
          // Also unsubscribe to the notifications if the user leaves the space.
          if (isSubscribed.value) {
            await toggleSubscription();
          }
          await client.unfollow(aliasWallet.value, aliasWallet.value.address, {
            from: web3Account.value,
            space: id
          });
        } else {
          await client.follow(aliasWallet.value, aliasWallet.value.address, {
            from: web3Account.value,
            space: id
          });
        }
        await loadFollows();
        loadingFollow.value = '';
      }
    } catch (e) {
      loadingFollow.value = '';
      console.error(e);
    }
  }

  return {
    clickFollow,
    loadFollows,
    loadSpaceFollowers,
    loadingFollow: computed(() => loadingFollow.value),
    isLoadingFollows: computed(() => isLoadingFollows.value),
    isLoadingSpaceFollowers: computed(() => isLoadingSpaceFollowers.value),
    isFollowing,
    followingSpaces,
    spaceFollowers
  };
}
