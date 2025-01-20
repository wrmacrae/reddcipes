// Learn more at developers.reddit.com/docs
import { Devvit, RedditAPIClient, RedisClient, useState, useAsync } from '@devvit/public-api';

Devvit.configure({
  redditAPI: true,
  redis: true,
  media: true,
});

async function makeRecipePost(redis: RedisClient, reddit: RedditAPIClient, title: string, picture: string, intro: string, ingredients: string, instructions: string) {
  const subredditName = (await reddit.getCurrentSubreddit()).name
  const post = await reddit.submitPost({
    title: title,
    subredditName: subredditName,
    preview: (
      <vstack>
        <text color="black white">Loading...</text>
      </vstack>
    ),
  });
  await redis.hSet(post.id, { title: title, picture: picture, intro: intro, ingredients: ingredients, instructions: instructions })
  return post.id
}


const postForm = Devvit.createForm(
  (data) => {
    return {
      fields: [
        {
          type: 'string',
          name: 'title',
          label: 'Title',
          required: true,
        },
        {
          type: 'image',
          name: 'picture',
          label: 'Picture of the result',
          required: true,
        },
        {
          type: 'string',
          name: 'intro',
          label: 'One-liner intro note. (Servings / time / pre-heat temperature; Optional)',
          required: true,
        },
        {
          type: 'paragraph',
          name: 'ingredients',
          label: 'Ingredients: (One per line with measurements.)',
          required: true,
        },
        {
          type: 'paragraph',
          name: 'instructions',
          label: 'Instructions: (One step per line. Do not number.)',
          required: true,
        }
       ],
       title: 'Post a Recipe',
       acceptLabel: 'Post',
    } as const; 
  }, async ({ values }, context) => {
    const { redis, reddit, ui } = context
    const { title, picture, intro, ingredients, instructions } = values
    const response = await context.media.upload({
      url: picture,
      type: 'image',
    })
    const postId = await makeRecipePost(redis, reddit, title, response.mediaUrl, intro, ingredients, instructions)
    // context.ui.navigateTo(postId);
  }
);

// Add a menu item to the subreddit menu for instantiating the new experience post
Devvit.addMenuItem({
  label: "Post a New Recipe",
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_, context) => {
    const { reddit, ui } = context;
    ui.showForm(postForm);
 },
});

function formatIntro(intro: string) {
  return <vstack backgroundColor='#cccccc' borderColor='black' cornerRadius='medium' width="93%" padding='small'>
      <text wrap color='black' alignment='center middle' weight='bold'>{intro}</text>
    </vstack>
}

function formatIngredients(ingredients: string) {
  return <vstack maxHeight="70">
      {Array.from(ingredients.split("\n").entries()).map((value: [number, string]) => <text size="medium" width='70' wrap>{ "- " + value[1]}</text>)}
    </vstack>
}

function formatInstructions(instructions: string) {
  return <vstack maxHeight="90">
      {Array.from(instructions.split("\n").entries()).map((value: [number, string]) =>
      <vstack>
        <text size="medium" width='60' wrap>{(value[0] + 1) + ". " + value[1]}</text>
      <spacer shape='thin' size='xsmall'></spacer>
      </vstack>)}
    </vstack>
}

function htmlForPicture(picture: string) {
  return <vstack cornerRadius='large' grow>
          <image url={picture}
            description="cookie"
            resizeMode='cover'
            height="100"
            width="100"
          /></vstack>
}

Devvit.addCustomPostType({
  name: 'Experience Post',
  height: 'tall',
  render: (context) => {
    const [showInstructions, setShowInstructions] = useState(false);
    const { data, loading, error } = useAsync(async () => {
      return await context.redis.hGetAll(context.postId!);
    });
    if (loading) {
      return <text>Loading...</text>;
    }
    
    if (error) {
      return <text>Error: {error.message}</text>;
    }
    
    if (!data) {
      return <text>No data available</text>;
    }
    return (

        <hstack width="98%" height="98%" padding='small'>
          <vstack width="40%" alignment="middle" padding='small'>
            {formatIntro(data.intro)}
            <text style='heading' outline='thin'>Ingredients:</text>
            {formatIngredients(data.ingredients)}
            <spacer></spacer>
            <button width="93%" onPress={() => setShowInstructions(!showInstructions)}>{showInstructions ? "Picture" : "Instructions"}</button>
          </vstack>
          { showInstructions ?
          <vstack gap="none" alignment='middle'>
            <text style='heading' outline='thin'>Directions:</text>
            {formatInstructions(data.instructions)}
          </vstack>
          :
          htmlForPicture(data!.picture)
          }
        </hstack>

    );
  },
});

export default Devvit;
