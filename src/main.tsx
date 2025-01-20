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
    console.log("Picture")
    console.log(picture)
    const response = await context.media.upload({
      url: picture,
      type: 'image',
    })
    console.log("response.mediaId")
    console.log(response.mediaId)
    const postId = await makeRecipePost(redis, reddit, title, response.mediaId, intro, ingredients, instructions)
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
  return <vstack backgroundColor='#cccccc' borderColor='black' cornerRadius='medium' width="93%">
      <text wrap>{intro}</text>
      <spacer shape='thin'></spacer>
    </vstack>
}

function formatIngredients(ingredients: string) {
  return <vstack>
      {ingredients.split("\n").map((ingredient: string) => <text size="small" wrap>{ingredient}</text>)}
    </vstack>
}

function formatInstructions(instructions: string) {
  return <vstack>
      {Array.from(instructions.split("\n").entries()).map((value: [number, string]) => <text size="small" wrap>{(value[0] + 1) + ". " + value[1]}</text>)}
    </vstack>
}

function htmlForPicture(picture: string) {
  return <vstack cornerRadius='large'>
          <image url="my-grandmas-snickerdoodles-recipe-barely-saved-from-being-v0-5o39g3k32lv91.jpeg"
            imageHeight={480}
            imageWidth={640}
            description="cookie"
            height="300px"
            width="400px"
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
      <vstack height="100%" width="100%" gap="medium" alignment="center middle">
        <hstack width="95%">
          <vstack width="35%" alignment="middle">
            {formatIntro(data.intro)}
            <text style='heading' outline='thin'>Ingredients:</text>
            {formatIngredients(data.ingredients)}
            <spacer></spacer>
            <button width="93%" onPress={() => setShowInstructions(!showInstructions)}>{showInstructions ? "Picture" : "Instructions"}</button>
          </vstack>
          { showInstructions ?
          <vstack gap="none">
            <text style='heading' outline='thin'>Directions:</text>
            {formatInstructions(data.instructions)}
          </vstack>
          :
          htmlForPicture(data!.picture)
          }
        </hstack>
      </vstack>
    );
  },
});

export default Devvit;
