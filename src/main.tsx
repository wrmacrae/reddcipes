// Learn more at developers.reddit.com/docs
import { Devvit, RedditAPIClient, RedisClient, useForm, useState, useAsync } from '@devvit/public-api';

Devvit.configure({
  redditAPI: true,
  redis: true,
  media: true,
});

async function makeRecipePost(redis: RedisClient, reddit: RedditAPIClient, title: string, picture: string, ingredients: string, intro: string, instructions: string) {
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
  await redis.hSet(post.id, { title: title, picture: picture, ingredients: ingredients, instructions: instructions })
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
    const postId = await makeRecipePost(redis, reddit, title, response.mediaUrl, ingredients, intro ?? "", instructions ?? "" )
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
    <vstack backgroundColor='#cccccc' borderColor='black' cornerRadius='medium' width="93%" padding='small'>
      <text wrap color='black' alignment='center middle' weight='bold'>{intro}</text>
    </vstack>
    : <vstack/>
}

function formatIngredients(ingredients: string) {
  return <vstack maxHeight="75%">
      {ingredients.split("\n").map((ingredient: string) => <text size="medium" wrap>{ "- " + ingredient}</text>)}
    </vstack>
}

function formatInstructions(instructions: string) {
  return <vstack maxHeight="90%">
      {Array.from(instructions.split("\n").entries()).map((value: [number, string]) =>
      <vstack>
        <text size="medium" wrap>{(value[0] + 1) + ". " + value[1]}</text>
      <spacer shape='thin' size='xsmall'></spacer>
      </vstack>)}
    </vstack>
}

function htmlForPicture(picture: string) {
  return <hstack cornerRadius='large' height='95%' alignment='middle' grow>
          <image url={picture}
            description="cookie"
            height="100%"
            width="100%"
            resizeMode='cover'
          /></hstack>
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
          await redis.hSet(context.postId!, { title: data.title, picture: values.picture, ingredients: values.ingredients, intro: values.intro ?? "", instructions: values.instructions ?? "" })
        } else {
          await redis.hSet(context.postId!, { title: data.title, ingredients: values.ingredients, intro: values.intro ?? "", instructions: values.instructions ?? "" })
        }
      }
    );
    return (
      <vstack height="100%" padding='small'>
        {/* height here in hstack will need to change based on whether the edit button appears */}
        <hstack height="90%" padding='small'>
          <vstack width="40%" alignment="middle" padding='small'>
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
          <vstack width="60%" gap="none" alignment='middle'>
            <text style='heading' outline='thin'>Directions:</text>
            {formatInstructions(data.instructions)}
          </vstack>
          :
          htmlForPicture(data!.picture)
          }
        </hstack>
        <button onPress={() => context.ui.showForm(editForm)}>Edit</button>
      </vstack>
    );
  },
});

export default Devvit;
