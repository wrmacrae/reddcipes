// Learn more at developers.reddit.com/docs
import { Devvit, RedditAPIClient, RedisClient, useForm, useState, useAsync, StateSetter } from '@devvit/public-api';

Devvit.configure({
  redditAPI: true,
  redis: true,
  media: true,
});

function postKey(postId: string): string {
  return `post-${postId}`
}

function formatTextRecipe(title: string, intro: string, ingredients: string, instructions: string) {
  return `${title}\n${intro}\nIngredients:\n${ingredients.split("\n").map((ingredient) => "- " + ingredient).join("\n")}\nInstructions:\n${Array.from(instructions.split("\n").entries()).map((value: [number, string]) => (value[0] + 1) + ". " + value[1]).join("\n")}`
}

async function makeRecipePost(context: Devvit.Context, title: string, picture: string, ingredients: string, intro: string, instructions: string) {
  const subredditName = (await context.reddit.getCurrentSubreddit()).name
  const post = await context.reddit.submitPost({
    title: title,
    subredditName: subredditName,
    preview: (
      <vstack>
        <text color="black white">Loading...</text>
      </vstack>
    ),
  });
  await context.redis.hSet(post.id, { title: title, picture: picture, ingredients: ingredients, instructions: instructions, intro: intro, author: context.userId! })
  await context.redis.hSet(postKey(post.id), { title: title, picture: picture, ingredients: ingredients, instructions: instructions, intro: intro, author: context.userId! })
  context.reddit.submitComment({text: formatTextRecipe(title, intro, ingredients, instructions), id: post.id})
  return post.id
}

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
    <vstack backgroundColor='transparent' borderColor='primary' cornerRadius='small' width="93%" padding='small'>
      <text wrap color='primary' alignment='center middle' weight='bold'>{intro}</text>
    </vstack>
    : <vstack/>
}

const INGREDIENTS_PER_PAGE = 10

function formatIngredients(ingredients: string, ingredientsPage: number) {
  return <vstack maxHeight="75%">
      {ingredients.split("\n").slice(ingredientsPage*INGREDIENTS_PER_PAGE, (ingredientsPage+1)*INGREDIENTS_PER_PAGE).map((ingredient: string) => <text size="medium" wrap>{ "- " + ingredient}</text>)}
    </vstack>
}

function colorChangerMaker(index: number, clickedInstruction: boolean[], setClickedInstruction: StateSetter<boolean[]>) {
  return () => {clickedInstruction[index] = !clickedInstruction[index]
    setClickedInstruction(clickedInstruction)}
}

const INSTRUCTIONS_PER_PAGE = 8

function formatInstructions(instructions: string, clickedInstruction: boolean[], setClickedInstruction: StateSetter<boolean[]>, instructionsPage: number) {
  return <vstack maxHeight="90%">
      {Array.from(instructions.split("\n").slice(instructionsPage*INSTRUCTIONS_PER_PAGE, (instructionsPage+1)*INSTRUCTIONS_PER_PAGE).entries()).map((value: [number, string]) =>
      <vstack>
        <hstack>
          <text weight='bold' size="large" wrap>{(instructionsPage*INSTRUCTIONS_PER_PAGE + value[0] + 1) + ". "}</text>
          <spacer shape='thin' size='xsmall'></spacer>
          <text size='medium' width="100%" wrap color={clickedInstruction[instructionsPage*INSTRUCTIONS_PER_PAGE + value[0]] ?? false ? 'neutral-content-weak' : 'neutral-content-strong'} onPress={colorChangerMaker(instructionsPage*INSTRUCTIONS_PER_PAGE + value[0], clickedInstruction, setClickedInstruction)}>{value[1]}</text>
        </hstack>
      <spacer shape='thin' size='xsmall'></spacer>
      </vstack>)}
    </vstack>
}

function htmlForPicture(picture: string) {
  return <hstack cornerRadius='large' height='100%' alignment='middle' grow>
          <image url={picture}
            description="cookie"
            height="100%"
            width="100%"
            resizeMode='cover'
          /></hstack>
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
    const { title, picture, intro, ingredients, instructions } = values
    const response = await context.media.upload({
      url: picture,
      type: 'image',
    })
    const postId = await makeRecipePost(context, title, response.mediaUrl, ingredients, intro ?? "", instructions ?? "" )
  }
);

function userKey(userId: string) {
  return `user-${userId}`
}

function savePost(context: Devvit.Context) {
  const postId = context.postId!
  context.reddit.submitComment({text: "I'm saving this Reddcipe for later!", id: postId})
  if (context.userId != undefined) {
      context.redis.hSet(userKey(context.userId!), {postId : "true"} )
  }
}

function unsavePost(context: Devvit.Context) {
  const postId = context.postId!
  if (context.userId != undefined) {
      context.redis.hDel(userKey(context.userId!), [postId])
  }
}

Devvit.addCustomPostType({
  name: 'Experience Post',
  height: 'tall',
  render: (context) => {
    const [showInstructions, setShowInstructions] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [ingredientsPage, setIngredientsPage] = useState(0);
    const [instructionsPage, setInstructionsPage] = useState(0);

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
    const [clickedInstruction, setClickedInstruction] = useState(Array(data.instructions.split("\n").length).fill(false));
    const postForm = useForm(
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
        ],
        title: 'Post a Recipe',
        acceptLabel: 'Post',
      }, async (values) => {
        const { title, picture, intro, ingredients, instructions } = values
        const response = await context.media.upload({
          url: picture,
          type: 'image',
        })
        const postId = await makeRecipePost(context, title, response.mediaUrl, ingredients, intro ?? "", instructions ?? "" )
      }
    );
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
          await redis.hSet(context.postId!, { title: data.title, picture: values.picture, ingredients: values.ingredients, intro: values.intro ?? "", instructions: values.instructions ?? "", author: context.userId! })
          await redis.hSet(postKey(context.postId!), { title: data.title, picture: values.picture, ingredients: values.ingredients, intro: values.intro ?? "", instructions: values.instructions ?? "", author: context.userId! })
        } else {
          await redis.hSet(context.postId!, { title: data.title, ingredients: values.ingredients, intro: values.intro ?? "", instructions: values.instructions ?? "", author: context.userId! })
          await redis.hSet(postKey(context.postId!), { title: data.title, ingredients: values.ingredients, intro: values.intro ?? "", instructions: values.instructions ?? "", author: context.userId! })
        }
      }
    );
    return (
      <zstack width="100%" height="100%">
        <vstack width="100%" height="100%" padding='small'>
          <hstack height="100%" padding='small'>
            <vstack width="40%" alignment="middle" padding='small'>
              {formatIntro(data.intro)}
              <spacer></spacer>
              <text style='heading' outline='thin'>Ingredients:</text>
              <hstack alignment='center'>{ingredientsPage > 0 ? <icon name="caret-up" size="medium" onPress={() => setIngredientsPage(ingredientsPage-1)}/> : <vstack/>}</hstack>
              {formatIngredients(data.ingredients, ingredientsPage)}
              <hstack alignment='center'>{(ingredientsPage+1)*INGREDIENTS_PER_PAGE < data.ingredients.split("\n").length ? <icon name="caret-down" size="medium" onPress={() => setIngredientsPage(ingredientsPage+1)}/> : <vstack/>}</hstack>
              {data.instructions != "" ?
              <vstack>
                <spacer></spacer>
                <button width="93%" appearance='primary' onPress={() => setShowInstructions(!showInstructions)}>{showInstructions ? "Picture" : "Instructions"}</button>
              </vstack>
              : <vstack/> }
            </vstack>
            { showInstructions ?
            <vstack width="60%" gap="none" alignment='middle'>
              <hstack alignment='center'>{instructionsPage > 0 ? <icon name="caret-up" size="medium" onPress={() => setInstructionsPage(instructionsPage-1)}/> : <vstack/>}</hstack>
              <text style='heading' outline='thin'>Directions:</text>
              {formatInstructions(data.instructions, clickedInstruction, setClickedInstruction, instructionsPage)}
              <hstack alignment='center'>{(instructionsPage+1)*INSTRUCTIONS_PER_PAGE < clickedInstruction.length ? <icon name="caret-down" size="medium" onPress={() => setInstructionsPage(instructionsPage+1)}/> : <vstack/>}</hstack>
            </vstack>
            :
            htmlForPicture(data!.picture)
            }
          </hstack>
        </vstack>
        {showMenu ?
        <vstack width="100%" height="100%" onPress={() => setShowMenu(false)}></vstack> :
        <vstack/> }
        <vstack padding='small'>
          <button appearance="bordered" onPress={() => setShowMenu(!showMenu)} icon={showMenu ? "close" : "overflow-horizontal"}></button>
          {showMenu ?
            <vstack darkBackgroundColor='rgb(26, 40, 45)' lightBackgroundColor='rgb(234, 237, 239)' cornerRadius='medium'>
              {data.author === context.userId! ? <hstack padding="small" onPress={() => context.ui.showForm(editForm)}><spacer/><icon lightColor='black' darkColor='white' name="edit" /><spacer/><text lightColor='black' darkColor='white' weight="bold">Edit</text><spacer/></hstack>
              : <hstack/>}
              <hstack padding="small" onPress={() => context.ui.showForm(postForm)}><spacer/><icon lightColor='black' darkColor='white' name="add" /><spacer/><text lightColor='black' darkColor='white' weight="bold">New</text><spacer/></hstack>
              <hstack padding="small" onPress={async () => {setIsSaved(!isSaved); if (isSaved) savePost(context); else unsavePost(context)}}><spacer/><icon lightColor='black' darkColor='white' name={isSaved ? "save-fill" : "save"} /><spacer/><text lightColor='black' darkColor='white' weight="bold">{isSaved ? "Unsave" : "Save"}</text><spacer/></hstack>
              {/* <hstack padding="small" onPress={() => console.log("Not yet implemented")}><spacer/><icon lightColor='black' darkColor='white' name="comment" /><spacer/><text lightColor='black' darkColor='white' weight="bold">Comment</text><spacer/></hstack> */}
            </vstack>
           : <vstack/> }
        </vstack>
      </zstack>
    );
  },
});

export default Devvit;
