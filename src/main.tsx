// Learn more at developers.reddit.com/docs
import { Devvit, RedditAPIClient, RedisClient, useForm, useState, useAsync } from '@devvit/public-api';

Devvit.configure({
  redditAPI: true,
  redis: true,
  media: true,
});

async function makeRecipePost(redis: RedisClient, reddit: RedditAPIClient, title: string, picture: string, ingredients: string, intro: string, instructions: string, link: string) {
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
  await redis.hSet(post.id, { title: title, picture: picture, ingredients: ingredients, intro: intro, instructions: instructions, link: link })
  return post.id
}


const postForm = Devvit.createForm(
    {
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
          required: false,
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
          required: false,
        },
        { type: 'string',
          name: 'link',
          label: 'Link to full recipe',
          required: false,
        },
       ],
       title: 'Post a Recipe',
       acceptLabel: 'Post',
    }, async ({ values }, context) => {
    const { redis, reddit, ui } = context
    const { title, picture, intro, ingredients, instructions, link } = values
    const response = await context.media.upload({
      url: picture,
      type: 'image',
    })
    await redis.hSet(post.id, { title: title, picture: picture, ingredients: ingredients, intro: intro ?? "", instructions: instructions ?? "", link: link ?? "" })
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
  return intro != "" ?
    <vstack backgroundColor='#cccccc' borderColor='black' cornerRadius='medium' width="93%">
      <text wrap>{intro}</text>
      <spacer shape='thin'></spacer>
    </vstack>
    : <vstack/>
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
          <image url={picture}
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
    const editForm = useForm(
      {
        fields: [
          {
            type: 'image',
            name: 'picture',
            label: 'New Picture (Leave blank to keep original)',
            required: false,
          },
          {
            type: 'string',
            name: 'intro',
            label: 'One-liner intro note. (Servings / time / pre-heat temperature; Optional)',
            required: false,
            defaultValue: data.intro,
          },
          {
            type: 'paragraph',
            name: 'ingredients',
            label: 'Ingredients: (One per line with measurements.)',
            required: true,
            defaultValue: data.ingredients,
          },
          {
            type: 'paragraph',
            name: 'instructions',
            label: 'Instructions: (One step per line. Do not number.)',
            required: false,
            defaultValue: data.instructions,
          },
          { type: 'string',
            name: 'link',
            label: 'Link to full recipe',
            required: false,
            defaultValue: data.link,
          },
        ],
        title: 'Edit the Recipe',
        acceptLabel: 'Update',
      }, async (values) => {
        const { redis, reddit, ui } = context
        if (values.picture != undefined) {
          const response = await context.media.upload({
            url: values.picture,
            type: 'image',
          })
          await redis.hSet(context.postId!, { title: data.title, picture: values.picture, ingredients: values.ingredients, intro: values.intro ?? "", instructions: values.instructions ?? "", link: values.link ?? "" })
        } else {
          await redis.hSet(context.postId!, { title: data.title, ingredients: values.ingredients, intro: values.intro ?? "", instructions: values.instructions ?? "", link: values.link ?? "" })
        }
      }
    );
    return (
      <vstack height="100%" width="100%" gap="medium" alignment="center middle">
        <hstack width="95%">
          <vstack width="35%" alignment="middle">
            {formatIntro(data.intro)}
            <text style='heading' outline='thin'>Ingredients:</text>
            {formatIngredients(data.ingredients)}
            {data.instructions != "" ?
            <vstack>
              <spacer></spacer>
              <button width="93%" onPress={() => setShowInstructions(!showInstructions)}>{showInstructions ? "Picture" : "Instructions"}</button>
            </vstack>
            : <vstack/> }
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
        {data.link != "" ? <text color="blue" text-decoration="underline" onPress={() => context.ui.navigateTo(data.link)}>{data.link}</text>
        : <vstack/>}
        <button onPress={() => context.ui.showForm(editForm)}>Edit</button>
      </vstack>
    );
  },
});

export default Devvit;
